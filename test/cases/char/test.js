import { strictEqual } from 'node:assert';

export function test (instance) {
  instance.chars.takeChar('p');
  strictEqual(instance.chars.returnChar(), 'p');
}
