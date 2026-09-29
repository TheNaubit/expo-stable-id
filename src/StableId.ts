import type { StableIdChangeEvent, StableIdConfig } from './StableId.types';
import { StableIdStore, _disposeAllStoresForTesting } from './StableIdStore';

let store: StableIdStore | null = null;
let configurePromise: Promise<string> | null = null;

function getStore(): StableIdStore {
  if (store === null) {
    throw new Error('StableId: call configure() before using other methods');
  }
  return store;
}

export async function configure(config?: StableIdConfig): Promise<string> {
  if (configurePromise !== null) {
    return configurePromise;
  }
  const newStore = new StableIdStore();
  configurePromise = newStore.configure(config).then((id) => {
    store = newStore;
    return id;
  }).catch((error) => {
    configurePromise = null;
    newStore.dispose();
    throw error;
  });
  return configurePromise;
}

export function getId(): string | null {
  return store?.getId() ?? null;
}

export function identify(id: string): void {
  getStore().identify(id);
}

export function generateNewId(): string {
  return getStore().generateNewId();
}

export function isConfigured(): boolean {
  return store?.isConfigured() ?? false;
}

export async function hasStoredId(): Promise<boolean> {
  if (store !== null) {
    return store.hasStoredId();
  }
  const tempStore = new StableIdStore();
  const result = await tempStore.hasStoredId();
  tempStore.dispose();
  return result;
}

export function addChangeListener(
  callback: (event: StableIdChangeEvent) => void
): { remove: () => void } {
  const unsubscribe = getStore().addChangeListener(callback);
  return { remove: unsubscribe };
}

export function setWillChangeHandler(
  handler: ((currentId: string, candidateId: string) => string | null) | null
): void {
  getStore().setWillChangeHandler(handler);
}

// For testing: reset the singleton
export function _resetForTesting(): void {
  if (store) {
    store.dispose();
  }
  store = null;
  configurePromise = null;
  _disposeAllStoresForTesting();
}
