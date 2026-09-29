import type { StableIdChangeEvent, StableIdConfig } from './StableId.types';
import { StableIdStore } from './StableIdStore';

// One store per app: StableIdProvider and the functional API share it, so they
// always see the same id, listeners and will-change handler
let sharedStore: StableIdStore | null = null;

export function getSharedStore(): StableIdStore {
  if (sharedStore === null) {
    sharedStore = new StableIdStore();
  }
  return sharedStore;
}

function getConfiguredStore(): StableIdStore {
  const store = getSharedStore();
  if (!store.isConfigured()) {
    throw new Error('StableId: call configure() before using other methods');
  }
  return store;
}

export function configure(config?: StableIdConfig): Promise<string> {
  return getSharedStore().configure(config);
}

export function getId(): string | null {
  return sharedStore?.getId() ?? null;
}

export function identify(id: string): void {
  getConfiguredStore().identify(id);
}

export function generateNewId(): string {
  return getConfiguredStore().generateNewId();
}

export function isConfigured(): boolean {
  return sharedStore?.isConfigured() ?? false;
}

export function hasStoredId(): Promise<boolean> {
  return getSharedStore().hasStoredId();
}

export function addChangeListener(
  callback: (event: StableIdChangeEvent) => void
): { remove: () => void } {
  const unsubscribe = getConfiguredStore().addChangeListener(callback);
  return { remove: unsubscribe };
}

export function setWillChangeHandler(
  handler: ((currentId: string, candidateId: string) => string | null) | null
): void {
  getConfiguredStore().setWillChangeHandler(handler);
}

// For testing: reset the singleton
export function _resetForTesting(): void {
  sharedStore?.dispose();
  sharedStore = null;
}
