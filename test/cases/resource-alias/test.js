import { deepStrictEqual } from 'node:assert';

export function test (instance) {
  deepStrictEqual(instance.unions.addOneInteger({ tag: 1, val: 23 }), { tag: 1, val: 24 });
  deepStrictEqual(instance.unions.addOneFloat({ tag: 1, val: 23 }), { tag: 1, val: 24.5 });
  deepStrictEqual(instance.unions.replaceFirstChar({ tag: 1, val: 'test' }, 'z'), { tag: 1, val: 'zest' });
}
