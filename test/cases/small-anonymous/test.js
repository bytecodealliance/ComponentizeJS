import { strictEqual, ok } from 'node:assert';

export function test (instance) {
  try {
    instance.anon.optionTest();
    ok(false);
  } catch (e) {
    strictEqual(e.payload, 'failure');
  }
  try {
    instance.anon.optionTest();
    ok(false);
  } catch (e) {
    strictEqual(e.payload, 'success');
  }
  strictEqual(instance.anon.optionTest(), 'outer');
  strictEqual(instance.anon.optionTest(), 'yay');
}
