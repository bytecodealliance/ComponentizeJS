import { strictEqual } from 'node:assert';

export function test (instance) {
  instance.exports.takeChar('p');
  strictEqual(instance.exports.returnChar(), 'p');
}
