import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  useCallback,
} from 'react';

import { getSharedStore } from './StableId';
import type { StableIdConfig } from './StableId.types';
import type { StableIdStore } from './StableIdStore';

const StableIdContext = createContext<StableIdStore | null>(null);

export interface StableIdProviderProps {
  readonly config?: StableIdConfig;
  readonly children: React.ReactNode;
}

export function StableIdProvider({ config, children }: StableIdProviderProps) {
  const store = getSharedStore();

  const [, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    store
      .configure(config)
      .then(() => {
        if (!disposed) {
          setReady(true);
        }
      })
      .catch(() => {
        // configure() failed - store remains unconfigured, getId() returns null
      });
    return () => {
      // The store is app-wide (shared with the functional API), so it is not disposed here
      disposed = true;
    };
    // config is intentionally excluded: configure() is idempotent (only first call takes effect).
    // Including config would cause dispose/re-configure cycles on unstable object references.
  }, [store]);

  return <StableIdContext.Provider value={store}>{children}</StableIdContext.Provider>;
}

export function useStableIdStore(): StableIdStore {
  const store = useContext(StableIdContext);
  if (store === null) {
    throw new Error('useStableId requires <StableIdProvider> as an ancestor');
  }
  return store;
}

export function useStableIdSnapshot(): string | null {
  const store = useStableIdStore();

  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);

  const getSnapshot = useCallback(() => store.getId(), [store]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
