import { strictEqual } from 'node:assert'

export function test(instance) {
    const { Thing, foo } = instance.resourceBorrowExport
    
    strictEqual(foo(new Thing(42)), 42 + 1 + 2)
}

