import { Thing, foo } from "test:test/resource-borrow-import";

export function test(value) {
    return foo(new Thing(value + 1)) + 4;
}

export function testBorrow(value) {
    const out = foo(value) + 6;
    value[Symbol.dispose]();
    return out;
}

export function testBorrowEarlyDrop(value) {
    const result = foo(value) + 8;
    value[Symbol.dispose]();
    return result;
}
