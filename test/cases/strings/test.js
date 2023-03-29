import { strictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.exports.a('test'), undefined);
  strictEqual(instance.exports.b(), 'test');
  strictEqual(instance.exports.c('😀', '😀'), '😀😀');

  let longString = '';
  const len = Math.floor(Math.random() * 10000);
  for (let i = 0; i < len; i++) {
    longString += 'long string\n';
  }
  strictEqual(instance.exports.a(longString), undefined);
  strictEqual(instance.exports.b(), longString);
}
