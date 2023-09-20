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
import { WasiCliEnvironment } from './imports/wasi-cli-environment';
import { WasiCliExit } from './imports/wasi-cli-exit';
import { WasiCliStderr } from './imports/wasi-cli-stderr';
import { WasiCliStdin } from './imports/wasi-cli-stdin';
import { WasiCliStdout } from './imports/wasi-cli-stdout';
import { WasiCliTerminalInput } from './imports/wasi-cli-terminal-input';
import { WasiCliTerminalOutput } from './imports/wasi-cli-terminal-output';
import { WasiCliTerminalStderr } from './imports/wasi-cli-terminal-stderr';
import { WasiCliTerminalStdin } from './imports/wasi-cli-terminal-stdin';
import { WasiCliTerminalStdout } from './imports/wasi-cli-terminal-stdout';
import { WasiClocksWallClock } from './imports/wasi-clocks-wall-clock';
import { WasiFilesystemPreopens } from './imports/wasi-filesystem-preopens';
import { WasiFilesystemTypes } from './imports/wasi-filesystem-types';
import { WasiIoStreams } from './imports/wasi-io-streams';
import { WasiRandomRandom } from './imports/wasi-random-random';
export function stubWasi(engine: Uint8Array | ArrayBuffer, stdout: boolean): Uint8Array;
export function spliceBindings(sourceName: string | null, spidermonkeyEngine: Uint8Array | ArrayBuffer, witWorld: string | null, witPath: string | null, worldName: string | null): SpliceResult;
