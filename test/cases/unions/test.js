import { strictEqual, deepStrictEqual } from 'node:assert';

export function test (instance) {
  deepStrictEqual(instance.exportUnions.addOneInteger({ tag: 1, val: 23 }), { tag: 1, val: 24 });
  deepStrictEqual(instance.exportUnions.addOneFloat({ tag: 1, val: 23 }), { tag: 1, val: 24.5 });
  deepStrictEqual(instance.exportUnions.replaceFirstChar({ tag: 1, val: 'test' }, 'z'), { tag: 1, val: 'zest' });
}
