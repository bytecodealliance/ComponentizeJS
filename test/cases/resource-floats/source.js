import { MyFloat as ImportFloat } from "resource-floats-imports";
import { MyFloat as ImportFloat2 } from "test:test/resource-floats";

const symbolDispose = Symbol.for('dispose');

class MyFloat {
    constructor(value) {
        this.value = new ImportFloat(value + 1);
    }

    get() {
        return this.value.get() + 3;
    }

    static add(a, b) {
        return new MyFloat(ImportFloat.add(a.value, b).get() + 5);
    }
}

export const resourceFloatsExports = { MyFloat }

export function add(a, b) {
    const out = new ImportFloat2(a.get() + b.get() + 5);
    a[symbolDispose]();
    b[symbolDispose]();
    return out;
}
