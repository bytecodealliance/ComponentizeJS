import { Thing, foo } from "test:test/resource-borrow-import"

const disposeSymbol = Symbol.dispose || Symbol.for('dispose')

export function test(value) {
    return foo(new Thing(value + 1)) + 4
}

export function testBorrow(value) {
    return foo(value) + 6
}

export function testBorrowEarlyDrop(value) {
    const result = foo(value) + 8
    value[disposeSymbol]()
    return result
}
