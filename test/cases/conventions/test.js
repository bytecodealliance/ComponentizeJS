import { strictEqual, deepStrictEqual } from 'node:assert';

export function test (instance) {
  const val = {
    howFastAreYouGoing: 999,
    iAmGoingExtremelySlow: 999999n
  };
  strictEqual(instance.conventions.foo(val), undefined);
  // checks roundtripping
  deepStrictEqual(globalThis.x, val);
}
