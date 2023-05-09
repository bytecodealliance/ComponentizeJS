export namespace Exports {
  export function spliceBindings(sourceName: string | null, spidermonkeyEngine: Uint8Array | ArrayBuffer, witWorld: string, witPath: string | null): SpliceResult;
}
/**
 * # Variants
 * 
 * ## `"i32"`
 * 
 * ## `"i64"`
 * 
 * ## `"f32"`
 * 
 * ## `"f64"`
 */
export type CoreTy = 'i32' | 'i64' | 'f32' | 'f64';
export interface CoreFn {
  params: CoreTy[],
  ret?: CoreTy,
  retptr: boolean,
  retsize: number,
  paramptr: boolean,
}
export interface SpliceResult {
  wasm: Uint8Array,
  jsBindings: string,
  exports: [string, CoreFn][],
  importWrappers: [string, string][],
  imports: [string, string[]][],
}
