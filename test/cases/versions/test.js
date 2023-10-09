import { strictEqual } from 'node:assert';

export function test (instance) {
    strictEqual(instance['local:hello/hello@1.0.0'].hello("foo"), "Hello 1.0.0, foo");
    strictEqual(instance['local:hello/hello@2.0.0'].hello("bar"), "Hello 2.0.0, bar");
    strictEqual(instance['local:hello/hello@2.0.0'].hello(undefined), undefined);
}
