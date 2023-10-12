import { Thing as ImportThing } from "test:test/resource-import-and-export"

class MyThing {
    constructor(value) {
        this.value = new ImportThing(value + 1)
    }

    foo() {
        return this.value.foo() + 2
    }

    bar(value) {
        this.value.bar(value + 3)
    }

    static baz(a, b) {
        return new MyThing(ImportThing.baz(a.value, b.value).foo() + 4)
    }
}

export const resourceImportAndExport = {
    Thing: MyThing
}
