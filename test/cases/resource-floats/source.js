import { Float as ImportFloat } from "resource-floats-imports"
import { Float as ImportFloat2 } from "test:test/resource-floats"

class Float {
    constructor(value) {
        this.value = new ImportFloat(value + 1)
    }

    get() {
        return this.value.get() + 3
    }

    static add(a, b) {
        return new Float(ImportFloat.add(a.value, b).get() + 5)
    }
}

export const resourceFloatsExports = { Float }

export function add(a, b) {
    return new ImportFloat2(a.get() + b.get() + 5)
}
