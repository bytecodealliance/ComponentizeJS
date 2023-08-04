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
import { ImportsEnvironment } from './imports/environment';
import { ImportsExit } from './imports/exit';
import { ImportsPreopens } from './imports/preopens';
import { ImportsStderr } from './imports/stderr';
import { ImportsStdin } from './imports/stdin';
import { ImportsStdout } from './imports/stdout';
import { ImportsWallClock } from './imports/wall-clock';
import { ImportsFilesystem } from './imports/filesystem';
import { ImportsStreams } from './imports/streams';
import { ImportsRandom } from './imports/random';
export function stubWasi(engine: Uint8Array | ArrayBuffer, stdout: boolean): Uint8Array;
export function spliceBindings(sourceName: string | null, spidermonkeyEngine: Uint8Array | ArrayBuffer, witWorld: string | null, witPath: string | null, worldName: string | null): SpliceResult;
