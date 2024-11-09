export function f(thing) {
    const value = thing.get();
    thing.set(value + 1);
}
