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
    (value: unknown): Variant => {
      if (typeof value === 'string') {
        // old format
        return { value: value };
      } else if (typeof value === 'object') {
        // new format
        return {
          value: value['value'],
          payload: value['payload'],
        };
      }
    },
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

  public get(key: string): V {
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
    await this.storage.put(this.namespace, JSON.stringify({ ...values }));
  }
}
