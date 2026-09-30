import { ExpoConfig } from 'expo/config';
import { withEntitlementsPlist } from 'expo/config-plugins';

jest.mock(
  '@nauverse/expo-cloud-settings/app.plugin',
  () => {
    const { withEntitlementsPlist: mockWithEntitlements } = require('expo/config-plugins');

    return function mockCloudSettingsPlugin(config: any, options: any = {}) {
      if (
        options.containerIdentifier !== undefined &&
        (typeof options.containerIdentifier !== 'string' ||
          options.containerIdentifier.trim().length === 0)
      ) {
        throw new Error('expo-cloud-settings: containerIdentifier must be a non-empty string');
      }

      return mockWithEntitlements(config, (mod: any) => {
        mod.modResults['com.apple.developer.ubiquity-kvstore-identifier'] =
          options.containerIdentifier ?? '$(TeamIdentifierPrefix)$(CFBundleIdentifier)';
        return mod;
      });
    };
  },
  { virtual: true }
);

jest.mock('expo/config-plugins', () => ({
  withEntitlementsPlist: jest.fn((config, callback) => {
    const mod = {
      ...config,
      modResults: {},
    };
    callback(mod);
    return mod;
  }),
}));

const withStableId = require('../app.plugin.js');

const baseConfig: ExpoConfig = {
  name: 'TestApp',
  slug: 'test-app',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('config plugin', () => {
  test('adds iCloud KVS entitlement with default identifier', () => {
    const result = withStableId(baseConfig) as any;
    expect(result.modResults['com.apple.developer.ubiquity-kvstore-identifier']).toBe(
      '$(TeamIdentifierPrefix)$(CFBundleIdentifier)'
    );
  });

  test('uses custom containerIdentifier when provided', () => {
    const result = withStableId(baseConfig, {
      containerIdentifier: 'com.example.custom',
    }) as any;
    expect(result.modResults['com.apple.developer.ubiquity-kvstore-identifier']).toBe(
      'com.example.custom'
    );
  });

  test('throws on empty containerIdentifier', () => {
    expect(() => withStableId(baseConfig, { containerIdentifier: '' })).toThrow(
      'containerIdentifier must be a non-empty string'
    );
  });

  test('throws on whitespace-only containerIdentifier', () => {
    expect(() => withStableId(baseConfig, { containerIdentifier: '   ' })).toThrow(
      'containerIdentifier must be a non-empty string'
    );
  });
});
