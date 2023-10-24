import { deepStrictEqual } from 'node:assert';

export function test (instance) {
    deepStrictEqual(instance.e1.a({ x: new instance.e1.X(42) }), [new instance.e1.X(42)])
    deepStrictEqual(instance.e2.a({ x: new instance.e1.X(7) }, { x: new instance.e1.X(8) }),
                    [ new instance.e1.X(7), new instance.e1.X(8) ] )    
}
