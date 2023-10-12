export class Thing {
    constructor(value) {
        this.value = value + " HostThing"
    }

    get() {
        return this.value + " HostThing.get"
    }
}

export function test(list) {
    return list.map((x) => new Thing(x.thing.value + " test"))
}
