import { strictEqual } from 'node:assert'
import { Thing } from "./resource-borrow-import.js"

export function test(instance) {
    strictEqual(instance.test(42), 42 + 1 + 2 + 3 + 4)
    
    let thing = new Thing(42)
    strictEqual(instance.testBorrow(thing), 42 + 2 + 3 + 6)
    strictEqual(instance.testBorrowEarlyDrop(thing), 42 + 2 + 3 + 8)
}
