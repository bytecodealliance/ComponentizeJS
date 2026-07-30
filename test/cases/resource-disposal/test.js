import { strictEqual } from 'node:assert';

const disposeSymbol = Symbol.dispose || Symbol.for('dispose');

export function test(instance) {
  const resource = new instance.resources.Example(42);

  strictEqual(resource.getId(), 42);
  resource[disposeSymbol]();
  strictEqual(instance.resources.disposeCount(), 1);

  resource[disposeSymbol]();
  strictEqual(instance.resources.disposeCount(), 1);
}
