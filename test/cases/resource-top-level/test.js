import { strictEqual } from 'node:assert';
import Thing from './thing.js';

export function test(instance) {
  const thing = new Thing(5);

  instance.f(thing);
  strictEqual(thing.get(), 6);
}
