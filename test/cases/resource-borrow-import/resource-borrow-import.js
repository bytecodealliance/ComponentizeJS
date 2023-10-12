export class Thing {
    constructor(value) {
        this.value = value + 2
    }
}

export function foo(thing) {
    return thing.value + 3
}
