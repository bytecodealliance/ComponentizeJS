export class Float {
    constructor(value) {
        this.value = value + 2
    }

    get() {
        return this.value + 4
    }

    static add(a, b) {
        return new Float(a.value + b + 6)
    }
}
