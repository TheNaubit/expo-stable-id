import {
  configure,
  getId,
  identify,
  generateNewId,
  isConfigured,
  hasStoredId,
  addChangeListener,
  setWillChangeHandler,
  _resetForTesting,
} from '../StableId';

let mockCloudStore: Record<string, string> = {};
let mockSecureStore: Record<string, string> = {};

jest.mock('@nauverse/expo-cloud-settings', () => ({
  getString: jest.fn((key: string) => mockCloudStore[key] ?? null),
  setString: jest.fn((key: string, value: string) => {
    mockCloudStore[key] = value;
  }),
  addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStore[key] ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStore[key] = value;
    return Promise.resolve();
  }),
}));

jest.mock('../generators/IDGenerator', () => {
  let mockCounter = 0;
  return {
    StandardGenerator: jest.fn().mockImplementation(() => ({
      generate: jest.fn(() => `mock-uuid-${++mockCounter}`),
    })),
    ShortIDGenerator: jest.fn(),
  };
});

beforeEach(() => {
  _resetForTesting();
  jest.clearAllMocks();
  mockCloudStore = {};
  mockSecureStore = {};
});

describe('StableId functional API', () => {
  describe('configure', () => {
    test('initializes singleton and returns ID', async () => {
      const id = await configure();
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    test('second call returns same ID', async () => {
      const id1 = await configure();
      const id2 = await configure({ id: 'different' });
      expect(id2).toBe(id1);
    });

    test('concurrent calls return same promise result', async () => {
      const [id1, id2] = await Promise.all([configure(), configure()]);
      expect(id1).toBe(id2);
    });
  });

  describe('getId', () => {
    test('returns null before configure', () => {
      expect(getId()).toBeNull();
    });

    test('returns ID after configure', async () => {
      const id = await configure();
      expect(getId()).toBe(id);
    });
  });

  describe('identify', () => {
    test('changes ID', async () => {
      await configure();
      identify('custom-id');
      expect(getId()).toBe('custom-id');
    });

    test('throws before configure', () => {
      expect(() => identify('id')).toThrow('call configure()');
    });

    test('throws on empty string', async () => {
      await configure();
      expect(() => identify('')).toThrow('id must be a non-empty string');
    });
  });

  describe('generateNewId', () => {
    test('creates new ID', async () => {
      await configure();
      const oldId = getId();
      const newId = generateNewId();
      expect(newId).not.toBe(oldId);
      expect(getId()).toBe(newId);
    });

    test('throws before configure', () => {
      expect(() => generateNewId()).toThrow('call configure()');
    });
  });

  describe('isConfigured', () => {
    test('returns false before configure', () => {
      expect(isConfigured()).toBe(false);
    });

    test('returns true after configure', async () => {
      await configure();
      expect(isConfigured()).toBe(true);
    });
  });

  describe('hasStoredId', () => {
    test('returns false when nothing stored', async () => {
      expect(await hasStoredId()).toBe(false);
    });

    test('returns true when cloud has ID', async () => {
      mockCloudStore['_StableID_Identifier'] = 'exists';
      expect(await hasStoredId()).toBe(true);
    });

    test('works after configure too', async () => {
      await configure();
      expect(await hasStoredId()).toBe(true);
    });
  });

  describe('addChangeListener', () => {
    test('fires on identify', async () => {
      await configure();
      const listener = jest.fn();
      addChangeListener(listener);
      identify('new-id');
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          newId: 'new-id',
          source: 'manual',
        })
      );
    });

    test('remove() unsubscribes', async () => {
      await configure();
      const listener = jest.fn();
      const sub = addChangeListener(listener);
      sub.remove();
      identify('after-remove');
      expect(listener).not.toHaveBeenCalled();
    });

    test('throws before configure', () => {
      expect(() => addChangeListener(jest.fn())).toThrow('call configure()');
    });
  });

  describe('setWillChangeHandler', () => {
    test('throws before configure', () => {
      expect(() => setWillChangeHandler(() => null)).toThrow('call configure()');
    });
  });
});
