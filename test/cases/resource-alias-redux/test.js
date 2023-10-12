import { deepStrictEqual } from 'node:assert'
import { Thing as HostThing } from "./resource-alias1.js"

export function test(instance) {
    const { Thing, a } = instance.resourceAlias1
    const { b } = instance.resourceAlias2

    let thing1 = new HostThing("Ni Hao")

    deepStrictEqual(instance.test([thing1]).map((x) => x.value), ["Ni Hao HostThing"])

    let thing2 = new Thing("Ciao")

    deepStrictEqual(a({ thing: thing2 }).map((x) => x.get()), ["Ciao Thing HostThing HostThing.get Thing.get"])

    let thing3 = new Thing("Ciao")
    let thing4 = new Thing("Aloha")

    deepStrictEqual(b({ thing: thing3 }, { thing: thing4 }).map((x) => x.get()),
                    ["Ciao Thing HostThing HostThing.get Thing.get",
                     "Aloha Thing HostThing HostThing.get Thing.get" ])
}
