import { Thing, foo } from "test:test/resource-borrow-import"

export function test(value) {
    return foo(new Thing(value + 1)) + 4
}
