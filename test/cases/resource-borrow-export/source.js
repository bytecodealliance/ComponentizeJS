class Thing {
    constructor(value) {
        this.value = value + 1
    }
}

function foo(thing) {
    return thing.value + 2
}

export const resourceBorrowExport = {
    Thing, foo
}
