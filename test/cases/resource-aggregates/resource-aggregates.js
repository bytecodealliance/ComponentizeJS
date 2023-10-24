export class Thing {
    constructor(value) {
        this.value = value + 2
    }
}

export function foo(r1, r2, r3, t1, t2, v1, v2, l1, l2, o1, o2, result1, result2) {
    return r1.thing.value
        + r2.thing.value
        + r3.thing1.value
        + r3.thing2.value
        + t1[0].value
        + t1[1].thing.value
        + t2[0].value
        + v1.val.value
        + v2.val.value
        + l1.reduce((acc, v) => acc + v.value, 0)
        + l2.reduce((acc, v) => acc + v.value, 0)
        + (o1 === undefined ? 0 : o1.value)
        + (o2 === undefined ? 0 : o2.value)
        + (result1.tag === "ok" ? result1.val.value : 0)
        + (result2.tag === "ok" ? result2.val.value : 0)
        + 3
}
