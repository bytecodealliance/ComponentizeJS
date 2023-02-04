import { strictEqual, deepStrictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.exports.e1Arg('a'), undefined);
  deepStrictEqual(instance.exports.e1Result(), 'a');

  strictEqual(instance.exports.u1Arg({ tag: 0, val: 23 }), undefined);
  deepStrictEqual(instance.exports.u1Result(), { tag: 0, val: 23 });
}
