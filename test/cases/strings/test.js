import { strictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.exports.a('test'), undefined);
  strictEqual(instance.exports.b(), 'test');
  strictEqual(instance.exports.c('😀', '😀'), '😀😀');
}
