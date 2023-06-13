export function roundtripFlag1 (f) {
  f.b0 = true;
  return f;
}
export function roundtripFlag2 (f) {
  f.b1 = true;
  return f;
}
export function roundtripFlag4 (f) {
  f.b3 = true;
  return f;
}
export function roundtripFlag8 (f) {
  f.b7 = true;
  return f;
}
export function roundtripFlag16 (f) {
  f.b15 = true;
  return f;
}
export function roundtripFlag32 (f) {
  f.b31 = true;
  return f;
}
export function roundtripFlag64 (f) {
  f.b63 = true;
  return f;
}
