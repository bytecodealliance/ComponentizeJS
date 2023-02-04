import { strictEqual, ok } from 'node:assert';

export function test (instance) {
  try {
    instance.exports.optionTest();
    ok(false);
  } catch (e) {
    strictEqual(e.payload, 'failure');
  }
  try {
    instance.exports.optionTest();
    ok(false);
  } catch (e) {
    strictEqual(e.payload, 'success');
  }
  strictEqual(instance.exports.optionTest(), 'outer');
  strictEqual(instance.exports.optionTest(), 'yay');
}
