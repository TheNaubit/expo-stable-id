import { StandardGenerator, ShortIDGenerator } from '../generators/IDGenerator';

// Mock expo-crypto with real crypto implementations for test environment
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
  getRandomValues: (array: Uint8Array) => require('crypto').getRandomValues(array),
}));

describe('StandardGenerator', () => {
  const generator = new StandardGenerator();

  test('generates a valid UUID v4 format', () => {
    const id = generator.generate();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('generates unique values', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generator.generate());
    }
    expect(ids.size).toBe(100);
  });
});

describe('ShortIDGenerator', () => {
  const generator = new ShortIDGenerator();

  test('generates 8-character string', () => {
    const id = generator.generate();
    expect(id).toHaveLength(8);
  });

  test('generates only alphanumeric characters', () => {
    const id = generator.generate();
    expect(id).toMatch(/^[A-Za-z0-9]{8}$/);
  });

  test('generates unique values', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generator.generate());
    }
    expect(ids.size).toBe(100);
  });
});
