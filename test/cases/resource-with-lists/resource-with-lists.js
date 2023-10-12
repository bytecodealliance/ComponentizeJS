export class Thing {
    constructor(list) {
        const suffix = new TextEncoder().encode(" HostThing")
        let result = new Uint8Array(list.length + suffix.length)
        result.set(list)
        result.set(suffix, list.length)
        this.value = result
    }

    foo() {
        let list = this.value
        const suffix = new TextEncoder().encode(" HostThing.foo")
        let result = new Uint8Array(list.length + suffix.length)
        result.set(list)
        result.set(suffix, list.length)
        return result
    }

    bar(list) {
        const suffix = new TextEncoder().encode(" HostThing.bar")
        let result = new Uint8Array(list.length + suffix.length)
        result.set(list)
        result.set(suffix, list.length)
        this.value = result
    }

    static baz(list) {
        const suffix = new TextEncoder().encode(" HostThing.baz")
        let result = new Uint8Array(list.length + suffix.length)
        result.set(list)
        result.set(suffix, list.length)
        return result
    }
}
