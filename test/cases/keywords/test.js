import { deepStrictEqual } from 'node:assert';

export function test (instance) {
  deepStrictEqual(instance.exports['type'](5), [6, 5]);
}
