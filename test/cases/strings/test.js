import { strictEqual } from 'node:assert';

export function test (instance) {
  strictEqual(instance.strings.a('test'), undefined);
  strictEqual(instance.strings.b(), 'test');
  strictEqual(instance.strings.c('😀', '😀'), '😀😀');

  let longString = '';
  const len = Math.floor(Math.random() * 10000);
  for (let i = 0; i < len; i++) {
    longString += 'long string\n';
  }
  strictEqual(instance.strings.a(longString), undefined);
  strictEqual(instance.strings.b(), longString);
}
