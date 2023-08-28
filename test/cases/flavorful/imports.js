let z;

export function fListInRecord1(a) {
  z = a;
}
export function fListInRecord2() {
  return z;
}
export function fListInRecord3(a) {
  a.a += z.a;
  return a;
}
export function fListInRecord4(a) {
  a.a += z.a;
  return a;
}
export function fListInVariant1(a, b) {
  z = [a, b];
}
export function fListInVariant2() {
  return JSON.stringify(z);
}
export function fListInVariant3(a) {
  return a;
}
export function errnoResult() {
  throw 'b';
}
export function listTypedefs(a, c) {
  return [new Uint8Array([1,2,3]), [a, ...c]];
}
export function listOfVariants(a, b, c) {
  return [[false, ...a], b, c];
}
