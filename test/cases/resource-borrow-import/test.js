import { strictEqual } from 'node:assert'

export function test(instance) {
    strictEqual(instance.test(42), 42 + 1 + 2 + 3 + 4)
}
