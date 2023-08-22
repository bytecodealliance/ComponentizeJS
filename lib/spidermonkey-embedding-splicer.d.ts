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
import { WasiCliEnvironment1 } from './imports/wasi-cli-environment';
import { WasiCliExit1 } from './imports/wasi-cli-exit';
import { WasiCliStderr1 } from './imports/wasi-cli-stderr';
import { WasiCliStdin1 } from './imports/wasi-cli-stdin';
import { WasiCliStdout1 } from './imports/wasi-cli-stdout';
import { WasiCliTerminalInput1 } from './imports/wasi-cli-terminal-input';
import { WasiCliTerminalOutput1 } from './imports/wasi-cli-terminal-output';
import { WasiCliTerminalStderr1 } from './imports/wasi-cli-terminal-stderr';
import { WasiCliTerminalStdin1 } from './imports/wasi-cli-terminal-stdin';
import { WasiCliTerminalStdout1 } from './imports/wasi-cli-terminal-stdout';
import { WasiClocksWallClock1 } from './imports/wasi-clocks-wall-clock';
import { WasiFilesystemPreopens1 } from './imports/wasi-filesystem-preopens';
import { WasiFilesystemTypes1 } from './imports/wasi-filesystem-types';
import { WasiIoStreams1 } from './imports/wasi-io-streams';
import { WasiRandomRandom1 } from './imports/wasi-random-random';
export function stubWasi(engine: Uint8Array | ArrayBuffer, stdout: boolean): Uint8Array;
export function spliceBindings(sourceName: string | null, spidermonkeyEngine: Uint8Array | ArrayBuffer, witWorld: string | null, witPath: string | null, worldName: string | null): SpliceResult;
