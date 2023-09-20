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
import { WasiCliEnvironment } from './interfaces/wasi-cli-environment';
import { WasiCliExit } from './interfaces/wasi-cli-exit';
import { WasiCliStderr } from './interfaces/wasi-cli-stderr';
import { WasiCliStdin } from './interfaces/wasi-cli-stdin';
import { WasiCliStdout } from './interfaces/wasi-cli-stdout';
import { WasiCliTerminalInput } from './interfaces/wasi-cli-terminal-input';
import { WasiCliTerminalOutput } from './interfaces/wasi-cli-terminal-output';
import { WasiCliTerminalStderr } from './interfaces/wasi-cli-terminal-stderr';
import { WasiCliTerminalStdin } from './interfaces/wasi-cli-terminal-stdin';
import { WasiCliTerminalStdout } from './interfaces/wasi-cli-terminal-stdout';
import { WasiClocksWallClock } from './interfaces/wasi-clocks-wall-clock';
import { WasiFilesystemPreopens } from './interfaces/wasi-filesystem-preopens';
import { WasiFilesystemTypes } from './interfaces/wasi-filesystem-types';
import { WasiIoStreams } from './interfaces/wasi-io-streams';
import { WasiRandomRandom } from './interfaces/wasi-random-random';
export function stubWasi(engine: Uint8Array, stdout: boolean): Uint8Array;
export function spliceBindings(sourceName: string | undefined, spidermonkeyEngine: Uint8Array, witWorld: string | undefined, witPath: string | undefined, worldName: string | undefined): SpliceResult;
