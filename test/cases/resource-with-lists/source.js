import { Thing as ImportThing } from "test:test/resource-with-lists"

class MyThing {
    constructor(list) {
        const suffix = new TextEncoder().encode(" Thing")
        let result = new Uint8Array(list.length + suffix.length)
        result.set(list)
        result.set(suffix, list.length)
        this.value = new ImportThing(result)
    }

    foo() {
        let list = this.value.foo()
        const suffix = new TextEncoder().encode(" Thing.foo")
        let result = new Uint8Array(list.length + suffix.length)
        result.set(list)
        result.set(suffix, list.length)
        return result
    }

    bar(list) {
        const suffix = new TextEncoder().encode(" Thing.bar")
        let result = new Uint8Array(list.length + suffix.length)
        result.set(list)
        result.set(suffix, list.length)
        this.value.bar(result)
    }

    static baz(list) {
        const suffix = new TextEncoder().encode(" Thing.baz")
        let result = new Uint8Array(list.length + suffix.length)
        result.set(list)
        result.set(suffix, list.length)
        let list2 = ImportThing.baz(result)
        const suffix2 = new TextEncoder().encode(" Thing.baz again")
        let result2 = new Uint8Array(list2.length + suffix2.length)
        result2.set(list2)
        result2.set(suffix2, list2.length)
        return result2
    }
}

export const resourceWithLists = {
    Thing: MyThing
}
