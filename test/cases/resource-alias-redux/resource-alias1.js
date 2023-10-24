export class Thing {
    constructor(value) {
        this.value = value + " HostThing"
    }

    get() {
        return this.value + " HostThing.get"
    }
}

export function a(f) {
    return [ f.thing ]
}
