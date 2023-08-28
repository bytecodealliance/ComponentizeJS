let z;
export function e1Arg(x) {
  z = x;
}
export function e1Result() {
  return z;
}
export function v1Arg(x) {
  z = x;
}
export function v1Result() {
  return z;
}
export function boolArg(x) {
  z = x;
}
export function boolResult() {
  return z;
}
export function resultArg(x) {
  z = x;
}
export function resultResult() {
  return z;
}
export function optionArg(x) {
  z = x;
}
export function optionResult() {
  return z;
}
export function casts (a, b, c, d, e, f) {
  return [a, b, c, d, e, f];
}
export function returnResultSugar() {
  throw 'bad1';
}
export function returnResultSugar2() {
  throw 'bad2';
}
export function returnResultSugar3() {
  throw 'bad1';
}
export function returnResultSugar4() {
  throw 'bad2';
}
export function returnOptionSugar() {
  throw 'bad1';
}
export function returnOptionSugar2() {
  return null;
}
export function resultSimple() {
  return [1, 2];
}
export function isCloneArg(x) {
  z = x;
}
export function isCloneReturn() {
  return z;
}
export function returnNamedOption() {
  return 22;
}
export function returnNamedResult() {
  return 22;
}
