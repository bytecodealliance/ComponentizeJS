import { deepStrictEqual } from 'node:assert'

export function test(instance) {
    const { Thing, test } = instance.resourceBorrowInRecord

    let thing1 = new Thing("Bonjour")
    let thing2 = new Thing("mon cher")

    deepStrictEqual(test([{ thing: thing1 }, { thing: thing2 }]).map((x) => x.get()),
                    ["Bonjour Thing HostThing test HostThing HostThing.get Thing.get",
                     "mon cher Thing HostThing test HostThing HostThing.get Thing.get"])
}
