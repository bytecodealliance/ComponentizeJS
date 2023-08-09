import { deepStrictEqual } from 'node:assert';

export function test (instance) {
  deepStrictEqual(instance.test(), { thing: 5 });
}
