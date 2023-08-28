import { strictEqual, deepStrictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.variants.e1Arg('a'), undefined);
  deepStrictEqual(instance.variants.e1Result(), 'a');
}
