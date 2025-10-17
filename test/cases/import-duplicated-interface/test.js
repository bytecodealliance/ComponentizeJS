import { strictEqual } from 'node:assert';

export function test(instance) {
  strictEqual(
    instance.exports.hello('hello'),
    'world hello (Hello 1.0.0, world)'
  );
  strictEqual(
    instance.exports.hello('hello-second'),
    'world hello-second (Hello 2.0.0, world)'
  );
  strictEqual(instance.exports.hello('unknown'), 'world unknown unknown');
}
