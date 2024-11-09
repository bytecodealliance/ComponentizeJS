import { strictEqual } from 'node:assert';

export function test(instance) {
  class Thing {
    constructor(v) {
      this.v = v;
    }
    get() {
      return this.v;
    }
    set(v) {
      this.v = v;
    }
  }

  const thing = new Thing(5);

  instance.f(thing);
  strictEqual(outThing.get(), 6);
}
