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
  imports: [string, string, number][],
}
import { Environment } from './interfaces/environment';
import { Exit } from './interfaces/exit';
import { Preopens } from './interfaces/preopens';
import { Stderr } from './interfaces/stderr';
import { Stdin } from './interfaces/stdin';
import { Stdout } from './interfaces/stdout';
import { WallClock } from './interfaces/wall-clock';
import { Filesystem } from './interfaces/filesystem';
import { Streams } from './interfaces/streams';
import { Random } from './interfaces/random';
export function stubWasi(engine: Uint8Array | ArrayBuffer, stdout: boolean): Uint8Array;
export function spliceBindings(sourceName: string | null, spidermonkeyEngine: Uint8Array | ArrayBuffer, witWorld: string | null, witPath: string | null, worldName: string | null): SpliceResult;
