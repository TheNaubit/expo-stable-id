import {
  getString as cloudGetString,
  setString as cloudSetString,
  addChangeListener as cloudAddChangeListener,
} from '@nauverse/expo-cloud-settings';
import { getItemAsync, setItemAsync } from 'expo-secure-store';

import { StableIdStore } from '../StableIdStore';

type ListenerCallback = (event: { changedKeys: string[]; reason: string }) => void;
const mockCloudListeners: ListenerCallback[] = [];
let mockCloudStore: Record<string, string> = {};
let mockSecureStore: Record<string, string> = {};

jest.mock('@nauverse/expo-cloud-settings', () => ({
  getString: jest.fn((key: string) => mockCloudStore[key] ?? null),
  setString: jest.fn((key: string, value: string) => {
    mockCloudStore[key] = value;
  }),
  addChangeListener: jest.fn((callback: ListenerCallback) => {
    mockCloudListeners.push(callback);
    return {
      remove: () => {
        const idx = mockCloudListeners.indexOf(callback);
        if (idx >= 0) mockCloudListeners.splice(idx, 1);
      },
    };
  }),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStore[key] ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStore[key] = value;
    return Promise.resolve();
  }),
}));

jest.mock('../generators/IDGenerator', () => {
  const mockGenerate = jest.fn(() => 'mock-generated-uuid');
  return {
    StandardGenerator: jest.fn().mockImplementation(() => ({
      generate: mockGenerate,
    })),
    ShortIDGenerator: jest.fn().mockImplementation(() => ({
      generate: jest.fn(() => 'mock8chr'),
    })),
    __mockGenerate: mockGenerate,
  };
});

const mockGenerateModule = jest.requireMock('../generators/IDGenerator');

function emitCloudChange(changedKeys: string[], reason = 'serverChange') {
  mockCloudListeners.forEach((cb) => cb({ changedKeys, reason }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCloudStore = {};
  mockSecureStore = {};
  mockCloudListeners.length = 0;
  mockGenerateModule.__mockGenerate.mockReturnValue('mock-generated-uuid');
});

describe('StableIdStore', () => {
  describe('configure', () => {
    test('with no stored ID generates new and persists to both', async () => {
      const store = new StableIdStore();
      const id = await store.configure();

      expect(id).toBe('mock-generated-uuid');
      expect(store.getId()).toBe('mock-generated-uuid');
      expect(cloudSetString).toHaveBeenCalledWith('_StableID_Identifier', 'mock-generated-uuid');
      expect(setItemAsync).toHaveBeenCalledWith('_StableID_Identifier', 'mock-generated-uuid');
      store.dispose();
    });

    test('with stored cloud ID uses cloud ID', async () => {
      mockCloudStore['_StableID_Identifier'] = 'cloud-id-123';
      const store = new StableIdStore();
      const id = await store.configure();

      expect(id).toBe('cloud-id-123');
      store.dispose();
    });

    test('with stored local ID (no cloud) uses local ID', async () => {
      mockSecureStore['_StableID_Identifier'] = 'local-id-456';
      const store = new StableIdStore();
      const id = await store.configure();

      expect(id).toBe('local-id-456');
      store.dispose();
    });

    test('prefers cloud over local when both exist', async () => {
      mockCloudStore['_StableID_Identifier'] = 'cloud-id';
      mockSecureStore['_StableID_Identifier'] = 'local-id';
      const store = new StableIdStore();
      const id = await store.configure();

      expect(id).toBe('cloud-id');
      store.dispose();
    });

    test('with id and forceUpdate policy uses provided id', async () => {
      mockCloudStore['_StableID_Identifier'] = 'stored-id';
      const store = new StableIdStore();
      const id = await store.configure({ id: 'forced-id', policy: 'forceUpdate' });

      expect(id).toBe('forced-id');
      store.dispose();
    });

    test('with id and preferStored policy uses stored when available', async () => {
      mockCloudStore['_StableID_Identifier'] = 'stored-id';
      const store = new StableIdStore();
      const id = await store.configure({ id: 'fallback-id', policy: 'preferStored' });

      expect(id).toBe('stored-id');
      store.dispose();
    });

    test('with id and preferStored policy uses provided id when no stored', async () => {
      const store = new StableIdStore();
      const id = await store.configure({ id: 'fallback-id', policy: 'preferStored' });

      expect(id).toBe('fallback-id');
      store.dispose();
    });

    test('with custom generator uses it', async () => {
      const customGenerator = { generate: jest.fn(() => 'custom-id') };
      const store = new StableIdStore();
      const id = await store.configure({ generator: customGenerator });

      expect(id).toBe('custom-id');
      expect(customGenerator.generate).toHaveBeenCalled();
      store.dispose();
    });

    test('second configure call returns existing ID', async () => {
      const store = new StableIdStore();
      const id1 = await store.configure();
      const id2 = await store.configure({ id: 'different-id' });

      expect(id2).toBe(id1);
      store.dispose();
    });

    test('subscribes to cloud change listener', async () => {
      const store = new StableIdStore();
      await store.configure();

      expect(cloudAddChangeListener).toHaveBeenCalled();
      expect(mockCloudListeners.length).toBe(1);
      store.dispose();
    });
  });

  describe('identify', () => {
    test('updates cache and both storages', async () => {
      const store = new StableIdStore();
      await store.configure();
      jest.clearAllMocks();

      store.identify('new-manual-id');

      expect(store.getId()).toBe('new-manual-id');
      expect(cloudSetString).toHaveBeenCalledWith('_StableID_Identifier', 'new-manual-id');
      expect(setItemAsync).toHaveBeenCalledWith('_StableID_Identifier', 'new-manual-id');
      store.dispose();
    });

    test('notifies change listeners', async () => {
      const store = new StableIdStore();
      await store.configure();
      const listener = jest.fn();
      store.addChangeListener(listener);

      store.identify('changed-id');

      expect(listener).toHaveBeenCalledWith({
        previousId: 'mock-generated-uuid',
        newId: 'changed-id',
        source: 'manual',
      });
      store.dispose();
    });

    test('notifies store listeners for useSyncExternalStore', async () => {
      const store = new StableIdStore();
      await store.configure();
      const listener = jest.fn();
      store.subscribe(listener);

      store.identify('new-id');

      expect(listener).toHaveBeenCalled();
      store.dispose();
    });
  });

  describe('generateNewId', () => {
    test('generates and updates and notifies', async () => {
      const store = new StableIdStore();
      await store.configure();
      const listener = jest.fn();
      store.addChangeListener(listener);

      mockGenerateModule.__mockGenerate.mockReturnValue('newly-generated-id');
      const newId = store.generateNewId();

      expect(newId).toBe('newly-generated-id');
      expect(store.getId()).toBe('newly-generated-id');
      expect(listener).toHaveBeenCalledWith({
        previousId: 'mock-generated-uuid',
        newId: 'newly-generated-id',
        source: 'manual',
      });
      store.dispose();
    });
  });

  describe('cloud change handling', () => {
    test('updates ID on cloud change for storage key', async () => {
      const store = new StableIdStore();
      await store.configure();
      const listener = jest.fn();
      store.addChangeListener(listener);

      mockCloudStore['_StableID_Identifier'] = 'cloud-synced-id';
      emitCloudChange(['_StableID_Identifier']);

      expect(store.getId()).toBe('cloud-synced-id');
      expect(listener).toHaveBeenCalledWith({
        previousId: 'mock-generated-uuid',
        newId: 'cloud-synced-id',
        source: 'cloud',
      });
      store.dispose();
    });

    test('ignores cloud change for other keys', async () => {
      const store = new StableIdStore();
      await store.configure();
      const listener = jest.fn();
      store.addChangeListener(listener);

      emitCloudChange(['some_other_key']);

      expect(listener).not.toHaveBeenCalled();
      store.dispose();
    });

    test('ignores cloud change when value is same', async () => {
      const store = new StableIdStore();
      await store.configure();
      const listener = jest.fn();
      store.addChangeListener(listener);

      mockCloudStore['_StableID_Identifier'] = 'mock-generated-uuid';
      emitCloudChange(['_StableID_Identifier']);

      expect(listener).not.toHaveBeenCalled();
      store.dispose();
    });

    test('syncs cloud change to secure store', async () => {
      const store = new StableIdStore();
      await store.configure();
      jest.clearAllMocks();

      mockCloudStore['_StableID_Identifier'] = 'synced-from-cloud';
      emitCloudChange(['_StableID_Identifier']);

      expect(setItemAsync).toHaveBeenCalledWith('_StableID_Identifier', 'synced-from-cloud');
      store.dispose();
    });
  });

  describe('willChangeHandler', () => {
    test('can intercept and modify candidate ID', async () => {
      const store = new StableIdStore();
      await store.configure();
      store.setWillChangeHandler((_current, candidate) => {
        return candidate + '-modified';
      });

      mockCloudStore['_StableID_Identifier'] = 'incoming-id';
      emitCloudChange(['_StableID_Identifier']);

      expect(store.getId()).toBe('incoming-id-modified');
      store.dispose();
    });

    test('returning null uses candidate as-is', async () => {
      const store = new StableIdStore();
      await store.configure();
      store.setWillChangeHandler(() => null);

      mockCloudStore['_StableID_Identifier'] = 'incoming-id';
      emitCloudChange(['_StableID_Identifier']);

      expect(store.getId()).toBe('incoming-id');
      store.dispose();
    });

    test('applies to identify()', async () => {
      const store = new StableIdStore();
      await store.configure();
      store.setWillChangeHandler((_current, candidate) => {
        return 'intercepted-' + candidate;
      });

      store.identify('manual-id');

      expect(store.getId()).toBe('intercepted-manual-id');
      store.dispose();
    });

    test('applies to generateNewId()', async () => {
      const store = new StableIdStore();
      await store.configure();
      store.setWillChangeHandler((_current, candidate) => {
        return 'prefix-' + candidate;
      });

      mockGenerateModule.__mockGenerate.mockReturnValue('gen-123');
      const result = store.generateNewId();

      expect(result).toBe('prefix-gen-123');
      expect(store.getId()).toBe('prefix-gen-123');
      store.dispose();
    });

    test('suppresses notification when handler returns current ID', async () => {
      const store = new StableIdStore();
      await store.configure();
      const listener = jest.fn();
      store.addChangeListener(listener);

      // willChangeHandler always returns the current ID, effectively blocking the change
      store.setWillChangeHandler((current) => current);

      store.identify('different-id');

      expect(listener).not.toHaveBeenCalled();
      expect(store.getId()).toBe('mock-generated-uuid');
      store.dispose();
    });
  });

  describe('input validation', () => {
    test('identify throws a clear error on non-string input', async () => {
      const store = new StableIdStore();
      await store.configure();
      expect(() => store.identify(123 as unknown as string)).toThrow(
        'id must be a non-empty string'
      );
      expect(() => store.identify(undefined as unknown as string)).toThrow(
        'id must be a non-empty string'
      );
      store.dispose();
    });

    test('identify throws on empty string', async () => {
      const store = new StableIdStore();
      await store.configure();
      expect(() => store.identify('')).toThrow('id must be a non-empty string');
      store.dispose();
    });

    test('identify throws on whitespace-only string', async () => {
      const store = new StableIdStore();
      await store.configure();
      expect(() => store.identify('   ')).toThrow('id must be a non-empty string');
      store.dispose();
    });
  });

  describe('hasStoredId', () => {
    test('returns true when cloud has stored ID', async () => {
      mockCloudStore['_StableID_Identifier'] = 'exists';
      const store = new StableIdStore();
      expect(await store.hasStoredId()).toBe(true);
      store.dispose();
    });

    test('returns true when only local has stored ID', async () => {
      mockSecureStore['_StableID_Identifier'] = 'local-only';
      const store = new StableIdStore();
      expect(await store.hasStoredId()).toBe(true);
      store.dispose();
    });

    test('returns false when nothing stored', async () => {
      const store = new StableIdStore();
      expect(await store.hasStoredId()).toBe(false);
      store.dispose();
    });
  });

  describe('dispose', () => {
    test('cleans up cloud subscription', async () => {
      const store = new StableIdStore();
      await store.configure();
      expect(mockCloudListeners.length).toBe(1);

      store.dispose();
      expect(mockCloudListeners.length).toBe(0);
    });

    test('clears all listeners', async () => {
      const store = new StableIdStore();
      await store.configure();
      const changeListener = jest.fn();
      const storeListener = jest.fn();
      store.addChangeListener(changeListener);
      store.subscribe(storeListener);

      store.dispose();
      // After dispose, new changes should not fire old listeners
      // (they've been cleared from the sets)
    });
  });

  describe('subscribe/getId', () => {
    test('getId returns current id', async () => {
      const store = new StableIdStore();
      expect(store.getId()).toBeNull();

      await store.configure();
      expect(store.getId()).toBe('mock-generated-uuid');
      store.dispose();
    });

    test('subscribe returns unsubscribe function', async () => {
      const store = new StableIdStore();
      await store.configure();
      const listener = jest.fn();
      const unsubscribe = store.subscribe(listener);

      store.identify('test');
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      store.identify('test2');
      expect(listener).toHaveBeenCalledTimes(1);
      store.dispose();
    });
  });

  describe('isConfigured', () => {
    test('returns false before configure', () => {
      const store = new StableIdStore();
      expect(store.isConfigured()).toBe(false);
      store.dispose();
    });

    test('returns true after configure', async () => {
      const store = new StableIdStore();
      await store.configure();
      expect(store.isConfigured()).toBe(true);
      store.dispose();
    });
  });

  describe('addChangeListener', () => {
    test('returns unsubscribe function', async () => {
      const store = new StableIdStore();
      await store.configure();
      const listener = jest.fn();
      const unsubscribe = store.addChangeListener(listener);

      store.identify('id1');
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      store.identify('id2');
      expect(listener).toHaveBeenCalledTimes(1);
      store.dispose();
    });
  });
});

describe('StableIdStore hardening', () => {
  test('concurrent configure calls share one run and one cloud subscription', async () => {
    const store = new StableIdStore();
    const [a, b] = await Promise.all([store.configure(), store.configure()]);
    expect(a).toBe(b);
    expect(cloudAddChangeListener).toHaveBeenCalledTimes(1);
    expect(mockCloudListeners).toHaveLength(1);
  });

  test('dispose during configure does not leak a cloud subscription', async () => {
    const store = new StableIdStore();
    const pending = store.configure();
    store.dispose();
    await pending;
    expect(mockCloudListeners).toHaveLength(0);
  });

  test('configure after dispose re-subscribes (StrictMode remount)', async () => {
    const store = new StableIdStore();
    const pending = store.configure();
    store.dispose();
    await store.configure();
    await pending;
    expect(mockCloudListeners).toHaveLength(1);
  });

  test('ignores empty or whitespace stored values', async () => {
    mockCloudStore['_StableID_Identifier'] = '   ';
    mockSecureStore['_StableID_Identifier'] = 'secure-id';
    const store = new StableIdStore();
    expect(await store.configure()).toBe('secure-id');
  });

  test('ignores whitespace config id', async () => {
    const store = new StableIdStore();
    expect(await store.configure({ id: '  ' })).toBe('mock-generated-uuid');
  });

  test('a throwing change listener does not block other listeners', async () => {
    jest.useFakeTimers();
    try {
      const store = new StableIdStore();
      await store.configure();
      const second = jest.fn();
      store.addChangeListener(() => {
        throw new Error('boom');
      });
      store.addChangeListener(second);
      store.identify('new-id');
      expect(store.getId()).toBe('new-id');
      expect(second).toHaveBeenCalledTimes(1);
      expect(() => jest.runAllTimers()).toThrow('boom');
    } finally {
      jest.useRealTimers();
    }
  });

  test('account change with no changed keys re-reads the stored id', async () => {
    const store = new StableIdStore();
    await store.configure();
    mockCloudStore['_StableID_Identifier'] = 'other-account-id';
    emitCloudChange([], 'accountChange');
    expect(store.getId()).toBe('other-account-id');
  });
});

describe('StableIdStore identity set during configure', () => {
  test('identify() while configure is pending is not overwritten', async () => {
    mockSecureStore['_StableID_Identifier'] = 'stored-id';
    const store = new StableIdStore();
    const listener = jest.fn();
    store.addChangeListener(listener);
    const pending = store.configure();
    store.identify('explicit-id');
    const resolved = await pending;
    expect(resolved).toBe('explicit-id');
    expect(store.getId()).toBe('explicit-id');
    expect(mockCloudStore['_StableID_Identifier']).toBe('explicit-id');
    expect(mockSecureStore['_StableID_Identifier']).toBe('explicit-id');
    store.dispose();
  });

  test('generateNewId() while configure is pending is not overwritten', async () => {
    mockSecureStore['_StableID_Identifier'] = 'stored-id';
    mockGenerateModule.__mockGenerate.mockReturnValue('fresh-id');
    const store = new StableIdStore();
    const pending = store.configure();
    store.generateNewId();
    await expect(pending).resolves.toBe('fresh-id');
    expect(store.getId()).toBe('fresh-id');
    store.dispose();
  });
});
