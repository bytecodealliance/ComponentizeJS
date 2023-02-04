import { strictEqual, deepStrictEqual, ok } from 'node:assert';

export function test (instance) {
  strictEqual(instance.exports.fListInRecord1({ a: 'a' }), undefined);
  deepStrictEqual(instance.exports.fListInRecord2(), { a: 'a' });

  deepStrictEqual(instance.exports.fListInRecord3({ a: 'b' }), { a: 'ba' });
  deepStrictEqual(instance.exports.fListInRecord4({ a: 'c' }), { a: 'ca' });

  strictEqual(instance.exports.fListInVariant1(null, { tag: 'ok' }, { tag: 0, val: 'test' }), undefined);
  deepStrictEqual(JSON.parse(instance.exports.fListInVariant2()), [null, { tag: 'ok'}, { tag: 0, val: 'test' }]);

  strictEqual(instance.exports.fListInVariant3('test'), 'test');

  try {
    instance.exports.errnoResult();
    ok(false);
  }
  catch (e) {
    strictEqual(e.payload, 'b');
  }

  deepStrictEqual(instance.exports.listTypedefs('test', ['some', 'strings']), [new Uint8Array([1, 2, 3]), ['test', 'some', 'strings']]);
  deepStrictEqual(instance.exports.listOfVariants([], [], []), [[false], [], []]);
}
