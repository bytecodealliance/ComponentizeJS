import { Thing as ImportThing, a as importA } from "test:test/resource-alias1"
import { b as importB } from "test:test/resource-alias2"

class Thing {
    constructor(value) {
        this.value = new ImportThing(value + " Thing")
    }

    get() {
        return this.value.get() + " Thing.get"
    }
}

function wrapImportThing(importThing) {
    let thing = Object.create(Thing.prototype)
    thing.value = importThing
    return thing
}

function a(f) {
    return importA({ thing: f.thing.value }).map(wrapImportThing)
}

export const resourceAlias1 = {
    Thing, a
}

function b(f, g) {
    return importB({ thing: f.thing.value }, { thing: g.thing.value }).map(wrapImportThing)
}

export const resourceAlias2 = {
    b
}

export function test(things) {
    return things
}
