import { deepStrictEqual } from 'node:assert'

export function test(instance) {
    const { Thing } = instance.resourceWithLists

    let encoder = new TextEncoder()
    
    let thing1 = new Thing(encoder.encode("Hi"))

    deepStrictEqual(thing1.foo(), encoder.encode("Hi Thing HostThing HostThing.foo Thing.foo"))

    thing1.bar(encoder.encode("Hola"))

    deepStrictEqual(thing1.foo(), encoder.encode("Hola Thing.bar HostThing.bar HostThing.foo Thing.foo"))

    deepStrictEqual(Thing.baz(encoder.encode("Ohayo Gozaimas")),
                    encoder.encode("Ohayo Gozaimas Thing.baz HostThing.baz Thing.baz again"))
}

