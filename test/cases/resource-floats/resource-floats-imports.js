export class MyFloat {
    constructor(value) {
        this.value = value + 2
    }

    get() {
        return this.value + 4
    }

    static add(a, b) {
        return new MyFloat(a.value + b + 6)
    }
}
