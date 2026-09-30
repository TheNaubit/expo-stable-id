import React from 'react';
import TestRenderer from 'react-test-renderer';

import {
  _resetForTesting,
  getId,
  identify,
  setWillChangeHandler,
  addChangeListener,
} from '../StableId';
import { StableIdProvider } from '../StableIdProvider';
import { useStableId } from '../useStableId';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let mockCloudStore: Record<string, string> = {};
let mockSecureStore: Record<string, string> = {};
type CloudListenerCallback = (event: { changedKeys: string[]; reason: string }) => void;
const mockCloudListeners: CloudListenerCallback[] = [];

jest.mock('@nauverse/expo-cloud-settings', () => ({
  getString: jest.fn((key: string) => mockCloudStore[key] ?? null),
  setString: jest.fn((key: string, value: string) => {
    mockCloudStore[key] = value;
  }),
  addChangeListener: jest.fn((callback: CloudListenerCallback) => {
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
  let mockCounter = 0;
  return {
    StandardGenerator: jest.fn().mockImplementation(() => ({
      generate: jest.fn(() => `mock-uuid-${++mockCounter}`),
    })),
    ShortIDGenerator: jest.fn(),
  };
});

const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('react-test-renderer is deprecated') ||
        args[0].includes('inside a test was not wrapped in act'))
    ) {
      return;
    }
    originalConsoleError(...args);
  };
});
afterAll(() => {
  console.error = originalConsoleError;
});

beforeEach(() => {
  _resetForTesting();
  jest.clearAllMocks();
  mockCloudStore = {};
  mockSecureStore = {};
  mockCloudListeners.length = 0;
});

function renderHook<T>(useHook: () => T) {
  const results: { current: T } = { current: undefined as T };
  function TestComponent() {
    results.current = useHook();
    return null;
  }
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      React.createElement(StableIdProvider, null, React.createElement(TestComponent))
    );
  });
  return {
    result: results,
    unmount: () => renderer.unmount(),
  };
}

async function flushPromises() {
  await TestRenderer.act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('StableIdProvider', () => {
  test('throws when hook used without provider', () => {
    expect(() => {
      TestRenderer.act(() => {
        TestRenderer.create(
          React.createElement(() => {
            useStableId();
            return null;
          })
        );
      });
    }).toThrow('useStableId requires <StableIdProvider>');
  });

  test('keeps one shared cloud subscription across unmount and remount', async () => {
    let renderer: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(StableIdProvider, null, null));
    });
    await flushPromises();
    expect(mockCloudListeners.length).toBe(1);

    TestRenderer.act(() => {
      renderer.unmount();
    });
    // The store is app-wide, so the functional API keeps working after unmount
    expect(mockCloudListeners.length).toBe(1);

    TestRenderer.act(() => {
      TestRenderer.create(React.createElement(StableIdProvider, null, null));
    });
    await flushPromises();
    expect(mockCloudListeners.length).toBe(1);
  });
});

describe('useStableId', () => {
  test('returns null before configure resolves', () => {
    const { result } = renderHook(() => useStableId());
    expect(result.current[0]).toBeNull();
  });

  test('returns ID after configure resolves', async () => {
    const { result } = renderHook(() => useStableId());
    await flushPromises();
    expect(result.current[0]).toBeTruthy();
    expect(typeof result.current[0]).toBe('string');
  });

  test('identify action changes the ID', async () => {
    const { result } = renderHook(() => useStableId());
    await flushPromises();

    TestRenderer.act(() => {
      result.current[1].identify('custom-user-id');
    });

    expect(result.current[0]).toBe('custom-user-id');
  });

  test('generateNewId action generates new ID', async () => {
    const { result } = renderHook(() => useStableId());
    await flushPromises();
    const oldId = result.current[0];

    let newId: string;
    TestRenderer.act(() => {
      newId = result.current[1].generateNewId();
    });

    expect(result.current[0]).not.toBe(oldId);
    expect(result.current[0]).toBe(newId!);
  });

  test('re-renders on cloud change', async () => {
    const { result } = renderHook(() => useStableId());
    await flushPromises();

    mockCloudStore['_StableID_Identifier'] = 'cloud-synced-value';
    TestRenderer.act(() => {
      mockCloudListeners.forEach((cb) =>
        cb({ changedKeys: ['_StableID_Identifier'], reason: 'serverChange' })
      );
    });

    expect(result.current[0]).toBe('cloud-synced-value');
  });
});

describe('provider and functional API share one store', () => {
  test('hook and getId() return the same id', async () => {
    const { result } = renderHook(() => useStableId());
    await flushPromises();
    expect(result.current[0]).toBeTruthy();
    expect(getId()).toBe(result.current[0]);
  });

  test('functional identify() updates the hook', async () => {
    const { result } = renderHook(() => useStableId());
    await flushPromises();
    TestRenderer.act(() => identify('user-42'));
    expect(result.current[0]).toBe('user-42');
  });

  test('hook identify() reaches functional listeners and handler', async () => {
    const { result } = renderHook(() => useStableId());
    await flushPromises();
    const listener = jest.fn();
    addChangeListener(listener);
    setWillChangeHandler((_current, candidate) => `${candidate}-checked`);
    TestRenderer.act(() => result.current[1].identify('from-hook'));
    expect(result.current[0]).toBe('from-hook-checked');
    expect(getId()).toBe('from-hook-checked');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
