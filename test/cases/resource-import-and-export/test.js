import { strictEqual } from 'node:assert'

export function test(instance) {
    const { Thing } = instance.resourceImportAndExport

    let thing1 = new Thing(42)

    strictEqual(thing1.foo(), 42 + 1 + 1 + 2 + 2)

    thing1.bar(33)

    strictEqual(thing1.foo(), 33 + 3 + 3 + 2 + 2)

    let thing2 = new Thing(81)
    let thing3 = Thing.baz(thing1, thing2)

    strictEqual(thing3.foo(), 33 + 3 + 3 + 81 + 1 + 1 + 2 + 2 + 4 + 1 + 2 + 4 + 1 + 1 + 2 + 2)
}
