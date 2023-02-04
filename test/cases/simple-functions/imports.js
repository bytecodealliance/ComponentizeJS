let z;

export function f1 () {
  z = 5;
}
export function f2 (a) {
  return z += a;
}
export function f3 (a, b) {
  z += a + b;
}
export function f4 () {
  return z;
}
export function f5 () {
  return [z, z + 2];
}
export function f6 (a, b, c) {
  return [z + a, z + b, z + c];
}
