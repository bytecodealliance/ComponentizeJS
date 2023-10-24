import { strictEqual } from 'node:assert'

export function test(instance) {
    const { Thing, foo } = instance.resourceAggregates
    
    let things = [];
    let expected = 0;
    for (let i = 1; i < 18; ++i) {
        things.push(new Thing(i))
        expected += i + 1 + 2
    }

    expected += 3 + 4;

    strictEqual(foo({ thing: things[0] },
                    { thing: things[1] },
                    { thing1: things[2], thing2: things[3] },
                    [ things[4], { thing: things[5] } ],
                    [ things[6] ],
                    { tag: "thing", val: things[7] },
                    { tag: "thing", val: things[8] },
                    [ things[9], things[10] ],
                    [ things[11], things[12] ],
                    things[13],
                    things[14],
                    { tag: "ok", val: things[15] },
                    { tag: "ok", val: things[16] }), expected)
}

