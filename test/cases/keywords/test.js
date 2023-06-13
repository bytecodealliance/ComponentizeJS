import { deepStrictEqual } from 'node:assert';

export function test (instance) {
  deepStrictEqual(instance.keywords['type'](5), [6, 5]);
}
