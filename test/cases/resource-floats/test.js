import { strictEqual } from 'node:assert' 
import { Float as HostFloat } from "./resource-floats.js"

export function test(instance) {
    const { Float } = instance.resourceFloatsExports

    let float1 = new HostFloat(42)
    let float2 = new HostFloat(55)

    strictEqual(instance.add(float1, float2).value, 42 + 1 + 3 + 55 + 1 + 3 + 5 + 1)

    let float3 = new Float(22)

    strictEqual(float3.get(), 22 + 1 + 2 + 4 + 3)

    let result = Float.add(float3, 7)

    strictEqual(result.get(), 22 + 1 + 2 + 7 + 6 + 2 + 4 + 5 + 1 + 2 + 4 + 3)
}
