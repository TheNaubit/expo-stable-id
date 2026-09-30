import { randomUUID, getRandomValues } from 'expo-crypto';

import type { IDGenerator } from '../StableId.types';

export class StandardGenerator implements IDGenerator {
  generate(): string {
    return randomUUID();
  }
}

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const REJECT_THRESHOLD = 256 - (256 % ALPHANUMERIC.length); // 248

export class ShortIDGenerator implements IDGenerator {
  generate(): string {
    let result = '';
    while (result.length < 8) {
      const bytes = new Uint8Array(16);
      getRandomValues(bytes);
      for (const byte of bytes) {
        if (result.length >= 8) break;
        if (byte < REJECT_THRESHOLD) {
          result += ALPHANUMERIC.charAt(byte % ALPHANUMERIC.length);
        }
      }
    }
    return result;
  }
}
