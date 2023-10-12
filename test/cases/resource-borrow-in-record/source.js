import { Thing as ImportThing, test as importTest } from "test:test/resource-borrow-in-record"

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

function test(list) {
    return importTest(list.map((x) => {
        return { thing: x.thing.value }
    })).map(wrapImportThing)
}

export const resourceBorrowInRecord = {
    Thing, test
}
