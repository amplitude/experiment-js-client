import { EvaluationFlag } from '@amplitude/experiment-core';

import { Storage } from '../types/storage';
import { Variant } from '../types/variant';

import { LocalStorage } from './local-storage';

export const getVariantStorage = (
  deploymentKey: string,
  instanceName: string,
  storage: Storage,
): LoadStoreCache<Variant> => {
  const truncatedDeployment = deploymentKey.substring(deploymentKey.length - 6);
  const namespace = `amp-exp-${instanceName}-${truncatedDeployment}`;
  return new LoadStoreCache<Variant>(
    namespace,
    storage,
    transformVariantFromStorage,
  );
};

export const getFlagStorage = (
  deploymentKey: string,
  instanceName: string,
  storage: Storage = new LocalStorage(),
): LoadStoreCache<EvaluationFlag> => {
  const truncatedDeployment = deploymentKey.substring(deploymentKey.length - 6);
  const namespace = `amp-exp-${instanceName}-${truncatedDeployment}-flags`;
  return new LoadStoreCache<EvaluationFlag>(namespace, storage);
};

export class LoadStoreCache<V> {
  private readonly namespace: string;
  private readonly storage: Storage;
  private readonly transformer: (value: unknown) => V | undefined;
  private cache: Record<string, V> = {};

  constructor(
    namespace: string,
    storage: Storage,
    transformer?: (value: unknown) => V,
  ) {
    this.namespace = namespace;
    this.storage = storage;
    this.transformer = transformer;
  }

  public get(key: string): V | undefined {
    return this.cache[key];
  }

  public getAll(): Record<string, V> {
    return { ...this.cache };
  }

  public put(key: string, value: V): void {
    this.cache[key] = value;
  }

  public putAll(values: Record<string, V>): void {
    for (const key of Object.keys(values)) {
      this.cache[key] = values[key];
    }
  }

  public remove(key: string): void {
    delete this.cache[key];
  }

  public clear(): void {
    this.cache = {};
  }

  public async load(): Promise<void> {
    const rawValues = await this.storage.get(this.namespace);
    let jsonValues: Record<string, unknown>;
    try {
      jsonValues = JSON.parse(rawValues) || {};
    } catch {
      // Do nothing
      return;
    }
    const values: Record<string, V> = {};
    for (const key of Object.keys(jsonValues)) {
      try {
        let value: V;
        if (this.transformer) {
          value = this.transformer(jsonValues[key]);
        } else {
          value = jsonValues[key] as V;
        }
        if (value) {
          values[key] = value;
        }
      } catch {
        // Do nothing
      }
    }
    this.clear();
    this.putAll(values);
  }

  public async store(values: Record<string, V> = this.cache): Promise<void> {
    await this.storage.put(this.namespace, JSON.stringify(values));
  }
}

export const transformVariantFromStorage = (storageValue: unknown): Variant => {
  if (typeof storageValue === 'string') {
    // From v0 string format
    return {
      key: storageValue,
      value: storageValue,
    };
  } else if (typeof storageValue === 'object') {
    // From v1 or v2 object format
    const key = storageValue['key'];
    const value = storageValue['value'];
    const payload = storageValue['payload'];
    let metadata = storageValue['metadata'];
    let experimentKey = storageValue['expKey'];
    if (metadata && metadata.experimentKey) {
      experimentKey = metadata.experimentKey;
    } else if (experimentKey) {
      metadata = metadata || {};
      metadata['experimentKey'] = experimentKey;
    }
    const variant: Variant = {};
    if (key) {
      variant.key = key;
    } else if (value) {
      variant.key = value;
    }
    if (value) variant.value = value;
    if (metadata) variant.metadata = metadata;
    if (payload) variant.payload = payload;
    if (experimentKey) variant.expKey = experimentKey;
    return variant;
  }
};
