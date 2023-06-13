import { strictEqual, deepStrictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.variants.e1Arg('a'), undefined);
  deepStrictEqual(instance.variants.e1Result(), 'a');

  strictEqual(instance.variants.u1Arg({ tag: 0, val: 23 }), undefined);
  deepStrictEqual(instance.variants.u1Result(), { tag: 0, val: 23 });
}
