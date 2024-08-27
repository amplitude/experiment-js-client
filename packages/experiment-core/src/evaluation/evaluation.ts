import {
  EvaluationCondition,
  EvaluationFlag,
  EvaluationSegment,
  EvaluationVariant,
  EvaluationOperator,
} from './flag';
import { hash32x86 } from './murmur3';
import { select } from './select';
import { SemanticVersion } from './semantic-version';

type EvaluationTarget = {
  context: Record<string, unknown>;
  result: Record<string, EvaluationVariant>;
};

export class EvaluationEngine {
  public evaluate(
    context: Record<string, unknown>,
    flags: EvaluationFlag[],
  ): Record<string, EvaluationVariant> {
    const results: Record<string, EvaluationVariant> = {};
    const target: EvaluationTarget = {
      context: context,
      result: results,
    };
    for (const flag of flags) {
      // Evaluate flag and update results.
      const variant = this.evaluateFlag(target, flag);
      if (variant) {
        results[flag.key] = variant;
      }
    }
    return results;
  }

  private evaluateFlag(
    target: EvaluationTarget,
    flag: EvaluationFlag,
  ): EvaluationVariant | undefined {
    let result: EvaluationVariant | undefined;
    for (const segment of flag.segments) {
      result = this.evaluateSegment(target, flag, segment);
      if (result) {
        // Merge all metadata into the result
        const metadata = {
          ...flag.metadata,
          ...segment.metadata,
          ...result.metadata,
        };
        result = { ...result, metadata: metadata };
        break;
      }
    }
    return result;
  }

  private evaluateSegment(
    target: EvaluationTarget,
    flag: EvaluationFlag,
    segment: EvaluationSegment,
  ): EvaluationVariant | undefined {
    if (!segment.conditions) {
      // Null conditions always match
      const variantKey = this.bucket(target, segment);
      if (variantKey !== undefined) {
        return flag.variants[variantKey];
      } else {
        return undefined;
      }
    }
    // Outer list logic is "or" (||)
    for (const conditions of segment.conditions) {
      let match = true;
      for (const condition of conditions) {
        match = this.matchCondition(target, condition);
        if (!match) {
          break;
        }
      }
      // On match, bucket the user.
      if (match) {
        const variantKey = this.bucket(target, segment);
        if (variantKey !== undefined) {
          return flag.variants[variantKey];
        } else {
          return undefined;
        }
      }
    }
    return undefined;
  }

  private matchCondition(
    target: EvaluationTarget,
    condition: EvaluationCondition,
  ): boolean {
    const propValue = select(target, condition.selector);
    // We need special matching for null properties and set type prop values
    // and operators. All other values are matched as strings, since the
    // filter values are always strings.
    if (!propValue) {
      return this.matchNull(condition.op, condition.values);
    } else if (this.isSetOperator(condition.op)) {
      const propValueStringList = this.coerceStringArray(propValue);
      if (!propValueStringList) {
        return false;
      }
      return this.matchSet(propValueStringList, condition.op, condition.values);
    } else {
      const propValueString = this.coerceString(propValue);
      if (propValueString !== undefined) {
        return this.matchString(
          propValueString,
          condition.op,
          condition.values,
        );
      } else {
        return false;
      }
    }
  }

  private getHash(key: string): number {
    return hash32x86(key);
  }

  private bucket(
    target: EvaluationTarget,
    segment: EvaluationSegment,
  ): string | undefined {
    if (!segment.bucket) {
      // A null bucket means the segment is fully rolled out. Select the
      // default variant.
      return segment.variant;
    }
    // Select the bucketing value.
    const bucketingValue = this.coerceString(
      select(target, segment.bucket.selector),
    );
    if (!bucketingValue || bucketingValue.length === 0) {
      // A null or empty bucketing value cannot be bucketed. Select the
      // default variant.
      return segment.variant;
    }
    // Salt and has the value, and compute the allocation and distribution
    // values.
    const keyToHash = `${segment.bucket.salt}/${bucketingValue}`;
    const hash = this.getHash(keyToHash);
    const allocationValue = hash % 100;
    const distributionValue = Math.floor(hash / 100);
    for (const allocation of segment.bucket.allocations) {
      const allocationStart = allocation.range[0];
      const allocationEnd = allocation.range[1];
      if (
        allocationValue >= allocationStart &&
        allocationValue < allocationEnd
      ) {
        for (const distribution of allocation.distributions) {
          const distributionStart = distribution.range[0];
          const distributionEnd = distribution.range[1];
          if (
            distributionValue >= distributionStart &&
            distributionValue < distributionEnd
          ) {
            return distribution.variant;
          }
        }
      }
    }
    return segment.variant;
  }

  private matchNull(op: string, filterValues: string[]): boolean {
    const containsNone = this.containsNone(filterValues);
    switch (op) {
      case EvaluationOperator.IS:
      case EvaluationOperator.CONTAINS:
      case EvaluationOperator.LESS_THAN:
      case EvaluationOperator.LESS_THAN_EQUALS:
      case EvaluationOperator.GREATER_THAN:
      case EvaluationOperator.GREATER_THAN_EQUALS:
      case EvaluationOperator.VERSION_LESS_THAN:
      case EvaluationOperator.VERSION_LESS_THAN_EQUALS:
      case EvaluationOperator.VERSION_GREATER_THAN:
      case EvaluationOperator.VERSION_GREATER_THAN_EQUALS:
      case EvaluationOperator.SET_IS:
      case EvaluationOperator.SET_CONTAINS:
      case EvaluationOperator.SET_CONTAINS_ANY:
        return containsNone;
      case EvaluationOperator.IS_NOT:
      case EvaluationOperator.DOES_NOT_CONTAIN:
      case EvaluationOperator.SET_DOES_NOT_CONTAIN:
      case EvaluationOperator.SET_DOES_NOT_CONTAIN_ANY:
        return !containsNone;
      default:
        return false;
    }
  }

  private matchSet(
    propValues: string[],
    op: string,
    filterValues: string[],
  ): boolean {
    switch (op) {
      case EvaluationOperator.SET_IS:
        return this.setEquals(propValues, filterValues);
      case EvaluationOperator.SET_IS_NOT:
        return !this.setEquals(propValues, filterValues);
      case EvaluationOperator.SET_CONTAINS:
        return this.matchesSetContainsAll(propValues, filterValues);
      case EvaluationOperator.SET_DOES_NOT_CONTAIN:
        return !this.matchesSetContainsAll(propValues, filterValues);
      case EvaluationOperator.SET_CONTAINS_ANY:
        return this.matchesSetContainsAny(propValues, filterValues);
      case EvaluationOperator.SET_DOES_NOT_CONTAIN_ANY:
        return !this.matchesSetContainsAny(propValues, filterValues);
      default:
        return false;
    }
  }

  private matchString(propValue: string, op: string, filterValues: string[]) {
    switch (op) {
      case EvaluationOperator.IS:
        return this.matchesIs(propValue, filterValues);
      case EvaluationOperator.IS_NOT:
        return !this.matchesIs(propValue, filterValues);
      case EvaluationOperator.CONTAINS:
        return this.matchesContains(propValue, filterValues);
      case EvaluationOperator.DOES_NOT_CONTAIN:
        return !this.matchesContains(propValue, filterValues);
      case EvaluationOperator.LESS_THAN:
      case EvaluationOperator.LESS_THAN_EQUALS:
      case EvaluationOperator.GREATER_THAN:
      case EvaluationOperator.GREATER_THAN_EQUALS:
        return this.matchesComparable<number>(
          propValue,
          op,
          filterValues,
          (value) => this.parseNumber(value),
          this.comparator,
        );
      case EvaluationOperator.VERSION_LESS_THAN:
      case EvaluationOperator.VERSION_LESS_THAN_EQUALS:
      case EvaluationOperator.VERSION_GREATER_THAN:
      case EvaluationOperator.VERSION_GREATER_THAN_EQUALS:
        return this.matchesComparable<SemanticVersion>(
          propValue,
          op,
          filterValues,
          (value) => SemanticVersion.parse(value),
          this.versionComparator,
        );
      case EvaluationOperator.REGEX_MATCH:
        return this.matchesRegex(propValue, filterValues);
      case EvaluationOperator.REGEX_DOES_NOT_MATCH:
        return !this.matchesRegex(propValue, filterValues);
      default:
        return false;
    }
  }

  private matchesIs(propValue: string, filterValues: string[]): boolean {
    if (this.containsBooleans(filterValues)) {
      const lower = propValue.toLowerCase();
      if (lower === 'true' || lower === 'false') {
        return filterValues.some((value) => value.toLowerCase() === lower);
      }
    }
    return filterValues.some((value) => propValue === value);
  }

  private matchesContains(propValue: string, filterValues: string[]): boolean {
    for (const filterValue of filterValues) {
      if (propValue.toLowerCase().includes(filterValue.toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  private matchesComparable<T>(
    propValue: string,
    op: string,
    filterValues: string[],
    typeTransformer: (value: string) => T | undefined,
    typeComparator: (propValue: T, op: string, filterValue: T) => boolean,
  ) {
    const propValueTransformed = typeTransformer(propValue);
    const filterValuesTransformed = filterValues
      .map((filterValue) => {
        return typeTransformer(filterValue);
      })
      .filter((filterValue) => {
        return filterValue !== undefined;
      }) as T[];
    if (
      propValueTransformed === undefined ||
      filterValuesTransformed.length === 0
    ) {
      return filterValues.some((filterValue) => {
        return this.comparator(propValue, op, filterValue);
      });
    } else {
      return filterValuesTransformed.some((filterValueTransformed) => {
        return typeComparator(propValueTransformed, op, filterValueTransformed);
      });
    }
  }

  private comparator(
    propValue: string | number,
    op: string,
    filterValue: string | number,
  ): boolean {
    switch (op) {
      case EvaluationOperator.LESS_THAN:
      case EvaluationOperator.VERSION_LESS_THAN:
        return propValue < filterValue;
      case EvaluationOperator.LESS_THAN_EQUALS:
      case EvaluationOperator.VERSION_LESS_THAN_EQUALS:
        return propValue <= filterValue;
      case EvaluationOperator.GREATER_THAN:
      case EvaluationOperator.VERSION_GREATER_THAN:
        return propValue > filterValue;
      case EvaluationOperator.GREATER_THAN_EQUALS:
      case EvaluationOperator.VERSION_GREATER_THAN_EQUALS:
        return propValue >= filterValue;
      default:
        return false;
    }
  }

  private versionComparator(
    propValue: SemanticVersion,
    op: string,
    filterValue: SemanticVersion,
  ): boolean {
    const compareTo = propValue.compareTo(filterValue);
    switch (op) {
      case EvaluationOperator.LESS_THAN:
      case EvaluationOperator.VERSION_LESS_THAN:
        return compareTo < 0;
      case EvaluationOperator.LESS_THAN_EQUALS:
      case EvaluationOperator.VERSION_LESS_THAN_EQUALS:
        return compareTo <= 0;
      case EvaluationOperator.GREATER_THAN:
      case EvaluationOperator.VERSION_GREATER_THAN:
        return compareTo > 0;
      case EvaluationOperator.GREATER_THAN_EQUALS:
      case EvaluationOperator.VERSION_GREATER_THAN_EQUALS:
        return compareTo >= 0;
      default:
        return false;
    }
  }

  private matchesRegex(propValue: string, filterValues: string[]): boolean {
    return filterValues.some((filterValue) =>
      Boolean(new RegExp(filterValue).exec(propValue)),
    );
  }

  private containsNone(filterValues: string[]): boolean {
    return filterValues.some((filterValue) => {
      return filterValue === '(none)';
    });
  }

  private containsBooleans(filterValues: string[]): boolean {
    return filterValues.some((filterValue) => {
      switch (filterValue.toLowerCase()) {
        case 'true':
        case 'false':
          return true;
        default:
          return false;
      }
    });
  }

  private parseNumber(value: string): number | undefined {
    return Number(value) ?? undefined;
  }

  private coerceString(value: unknown | undefined): string | undefined {
    if (!value) {
      return undefined;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  private coerceStringArray(value: unknown): string[] | undefined {
    if (Array.isArray(value)) {
      const anyArray = value as unknown[];
      return anyArray
        .map((e) => this.coerceString(e))
        .filter(Boolean) as string[];
    }
    const stringValue = String(value);
    try {
      const parsedValue = JSON.parse(stringValue);
      if (Array.isArray(parsedValue)) {
        const anyArray = value as unknown[];
        return anyArray
          .map((e) => this.coerceString(e))
          .filter(Boolean) as string[];
      } else {
        const s = this.coerceString(stringValue);
        return s ? [s] : undefined;
      }
    } catch {
      const s = this.coerceString(stringValue);
      return s ? [s] : undefined;
    }
  }

  private isSetOperator(op: string) {
    switch (op) {
      case EvaluationOperator.SET_IS:
      case EvaluationOperator.SET_IS_NOT:
      case EvaluationOperator.SET_CONTAINS:
      case EvaluationOperator.SET_DOES_NOT_CONTAIN:
      case EvaluationOperator.SET_CONTAINS_ANY:
      case EvaluationOperator.SET_DOES_NOT_CONTAIN_ANY:
        return true;
      default:
        return false;
    }
  }

  private setEquals(xa: string[], ya: string[]): boolean {
    const xs = new Set(xa);
    const ys = new Set(ya);
    return xs.size === ys.size && [...ys].every((y) => xs.has(y));
  }

  private matchesSetContainsAll(
    propValues: string[],
    filterValues: string[],
  ): boolean {
    if (propValues.length < filterValues.length) {
      return false;
    }
    for (const filterValue of filterValues) {
      if (!this.matchesIs(filterValue, propValues)) {
        return false;
      }
    }
    return true;
  }

  private matchesSetContainsAny(
    propValues: string[],
    filterValues: string[],
  ): boolean {
    for (const filterValue of filterValues) {
      if (this.matchesIs(filterValue, propValues)) {
        return true;
      }
    }
    return false;
  }
}
