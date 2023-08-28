import { strictEqual, deepStrictEqual, ok } from 'node:assert';

export function test (instance) {
  strictEqual(instance.test.fListInRecord1({ a: 'a' }), undefined);
  deepStrictEqual(instance.test.fListInRecord2(), { a: 'a' });

  deepStrictEqual(instance.test.fListInRecord3({ a: 'b' }), { a: 'ba' });
  deepStrictEqual(instance.test.fListInRecord4({ a: 'c' }), { a: 'ca' });

  strictEqual(instance.test.fListInVariant1(null, { tag: 'ok' }, { tag: 0, val: 'test' }), undefined);
  deepStrictEqual(JSON.parse(instance.test.fListInVariant2()), [null, { tag: 'ok'}]);

  strictEqual(instance.test.fListInVariant3('test'), 'test');

  try {
    instance.test.errnoResult();
    ok(false);
  }
  catch (e) {
    strictEqual(e.payload, 'b');
  }

  deepStrictEqual(instance.test.listTypedefs('test', ['some', 'strings']), [new Uint8Array([1, 2, 3]), ['test', 'some', 'strings']]);
  deepStrictEqual(instance.test.listOfVariants([], [], []), [[false], [], []]);
}
