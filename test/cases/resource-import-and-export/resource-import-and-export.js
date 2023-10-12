export class Thing {
    constructor(value) {
        this.value = value + 1
    }

    foo() {
        return this.value + 2
    }

    bar(value) {
        this.value = value + 3
    }

    static baz(a, b) {
        return new Thing(a.foo() + b.foo() + 4)
    }
}
