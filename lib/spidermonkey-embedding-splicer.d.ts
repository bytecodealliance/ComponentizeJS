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
import { WasiCliBaseEnvironment } from './imports/wasi-cli-base-environment';
import { WasiCliBaseExit } from './imports/wasi-cli-base-exit';
import { WasiCliBasePreopens } from './imports/wasi-cli-base-preopens';
import { WasiCliBaseStderr } from './imports/wasi-cli-base-stderr';
import { WasiCliBaseStdin } from './imports/wasi-cli-base-stdin';
import { WasiCliBaseStdout } from './imports/wasi-cli-base-stdout';
import { WasiClocksWallClock } from './imports/wasi-clocks-wall-clock';
import { WasiFilesystemFilesystem } from './imports/wasi-filesystem-filesystem';
import { WasiIoStreams } from './imports/wasi-io-streams';
import { WasiRandomRandom } from './imports/wasi-random-random';
export function stubWasi(engine: Uint8Array | ArrayBuffer, stdout: boolean): Uint8Array;
export function spliceBindings(sourceName: string | null, spidermonkeyEngine: Uint8Array | ArrayBuffer, witWorld: string | null, witPath: string | null, worldName: string | null): SpliceResult;
