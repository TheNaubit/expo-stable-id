interface Subscription {
  remove: () => void;
}

import {
  getString as cloudGetString,
  setString as cloudSetString,
  addChangeListener as cloudAddChangeListener,
} from '@nauverse/expo-cloud-settings';
import {
  getItemAsync as secureGetItem,
  setItemAsync as secureSetItem,
} from 'expo-secure-store';

import type {
  IDGenerator,
  IDPolicy,
  StableIdChangeEvent,
  StableIdConfig,
  ChangeSource,
  WillChangeHandler,
} from './StableId.types';
import { StandardGenerator } from './generators/IDGenerator';

type Listener = () => void;
type ChangeCallback = (event: StableIdChangeEvent) => void;

const STORAGE_KEY = '_StableID_Identifier';

export class StableIdStore {
  private id: string | null = null;
  private generator: IDGenerator = new StandardGenerator();
  private policy: IDPolicy = 'forceUpdate';
  private configured = false;
  private willChangeHandler: WillChangeHandler | null = null;
  private changeListeners = new Set<ChangeCallback>();
  private storeListeners = new Set<Listener>();
  private cloudSubscription: Subscription | null = null;
  private configurePromise: Promise<string> | null = null;
  private disposed = false;

  private static isUsable(value: string | null | undefined): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private static reportAsync(error: unknown): void {
    // Surface listener errors without breaking the remaining listeners
    setTimeout(() => {
      throw error;
    }, 0);
  }

  private async readStored(): Promise<string | null> {
    try {
      const cloudValue = cloudGetString(STORAGE_KEY);
      if (StableIdStore.isUsable(cloudValue)) {
        return cloudValue;
      }
    } catch {
      // Cloud not available (e.g., Android)
    }

    try {
      const localValue = await secureGetItem(STORAGE_KEY);
      if (StableIdStore.isUsable(localValue)) {
        return localValue;
      }
    } catch {
      // Secure store not available
    }

    return null;
  }

  private persist(id: string): void {
    try {
      cloudSetString(STORAGE_KEY, id);
    } catch {
      // Cloud not available
    }

    secureSetItem(STORAGE_KEY, id).catch(() => {
      // Secure store write failed
    });
  }

  private notifyChange(previousId: string | null, newId: string, source: ChangeSource): void {
    const event: StableIdChangeEvent = { previousId, newId, source };
    for (const listener of Array.from(this.changeListeners)) {
      try {
        listener(event);
      } catch (error) {
        StableIdStore.reportAsync(error);
      }
    }
  }

  private notifyStore(): void {
    for (const listener of Array.from(this.storeListeners)) {
      try {
        listener();
      } catch (error) {
        StableIdStore.reportAsync(error);
      }
    }
  }

  private applyWillChange(candidateId: string): string {
    if (this.willChangeHandler === null || this.id === null) {
      return candidateId;
    }
    const result = this.willChangeHandler(this.id, candidateId);
    return result ?? candidateId;
  }

  configure(config?: StableIdConfig): Promise<string> {
    this.disposed = false;
    if (this.configurePromise === null) {
      this.configurePromise = this.runConfigure(config).catch((error) => {
        this.configurePromise = null;
        throw error;
      });
    }
    return this.configurePromise.then((id) => {
      this.ensureCloudSubscription();
      return id;
    });
  }

  private async runConfigure(config?: StableIdConfig): Promise<string> {
    if (config?.generator) {
      this.generator = config.generator;
    }
    if (config?.policy) {
      this.policy = config.policy;
    }

    const stored = await this.readStored();

    // identify()/generateNewId() ran while storage was being read: that explicit
    // identity is newer than anything stored, and setIdentity already persisted it
    if (this.id !== null) {
      this.configured = true;
      return this.id;
    }

    let resolvedId: string;

    if (StableIdStore.isUsable(config?.id)) {
      if (this.policy === 'preferStored' && stored !== null) {
        resolvedId = stored;
      } else {
        resolvedId = config!.id!;
      }
    } else {
      resolvedId = stored ?? this.generator.generate();
    }

    this.id = resolvedId;
    this.configured = true;
    this.persist(resolvedId);
    this.notifyStore();
    return resolvedId;
  }

  private ensureCloudSubscription(): void {
    if (this.disposed || this.cloudSubscription !== null) {
      return;
    }
    this.cloudSubscription = cloudAddChangeListener((event) => {
      this.onCloudChange(event.changedKeys, event.reason);
    });
  }

  private onCloudChange(changedKeys: readonly string[], reason?: string): void {
    // An account change may report no keys even though every value changed
    const affectsAll = reason === 'accountChange' || changedKeys.length === 0;
    if (!affectsAll && !changedKeys.includes(STORAGE_KEY)) {
      return;
    }

    let cloudValue: string | null = null;
    try {
      cloudValue = cloudGetString(STORAGE_KEY);
    } catch {
      return;
    }

    if (cloudValue === null || cloudValue.trim().length === 0 || cloudValue === this.id) {
      return;
    }

    this.setIdentity(cloudValue, 'cloud');
  }

  getId(): string | null {
    return this.id;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  private setIdentity(candidateId: string, source: ChangeSource): string {
    if (candidateId === this.id) {
      return candidateId;
    }
    const previousId = this.id;
    const finalId = this.applyWillChange(candidateId);
    if (finalId === previousId) {
      return finalId;
    }
    this.id = finalId;
    this.persist(finalId);
    this.notifyStore();
    this.notifyChange(previousId, finalId, source);
    return finalId;
  }

  identify(id: string): void {
    if (!StableIdStore.isUsable(id)) {
      throw new Error('StableId: id must be a non-empty string');
    }
    this.setIdentity(id, 'manual');
  }

  generateNewId(): string {
    const newId = this.generator.generate();
    return this.setIdentity(newId, 'manual');
  }

  async hasStoredId(): Promise<boolean> {
    const stored = await this.readStored();
    return stored !== null;
  }

  subscribe(listener: Listener): () => void {
    this.storeListeners.add(listener);
    return () => {
      this.storeListeners.delete(listener);
    };
  }

  addChangeListener(callback: ChangeCallback): () => void {
    this.changeListeners.add(callback);
    return () => {
      this.changeListeners.delete(callback);
    };
  }

  setWillChangeHandler(handler: WillChangeHandler | null): void {
    this.willChangeHandler = handler;
  }

  dispose(): void {
    this.disposed = true;
    if (this.cloudSubscription) {
      this.cloudSubscription.remove();
      this.cloudSubscription = null;
    }
    this.changeListeners.clear();
    this.storeListeners.clear();
  }
}
