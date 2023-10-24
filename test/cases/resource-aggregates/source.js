import { Thing as ImportThing, foo as importFoo } from "test:test/resource-aggregates"

class Thing {
    constructor(value) {
        this.value = new ImportThing(value + 1)
    }
}

function foo(r1, r2, r3, t1, t2, v1, v2, l1, l2, o1, o2, result1, result2) {
    return importFoo({ thing: r1.thing.value },
                     { thing: r2.thing.value },
                     { thing1: r3.thing1.value, thing2: r3.thing2.value },
                     [ t1[0].value, { thing: t1[1].thing.value } ],
                     [ t2[0].value ],
                     { tag: v1.tag, val: v1.val.value },
                     { tag: v2.tag, val: v2.val.value },
                     l1.map((x) => x.value),
                     l2.map((x) => x.value),
                     o1 === undefined ? undefined : o1.value,
                     o2 === undefined ? undefined : o2.value,
                     result1.tag === "ok" ? { tag: "ok", val: result1.val.value } : { tag: "err" },
                     result2.tag === "ok" ? { tag: "ok", val: result2.val.value } : { tag: "err" }) + 4
}

export const resourceAggregates = {
    Thing, foo
}
