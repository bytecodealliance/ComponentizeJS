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
import { WasiCliEnvironment020rc20231105 } from './interfaces/wasi-cli-environment-0.2.0-rc-2023-11-05';
import { WasiCliExit020rc20231105 } from './interfaces/wasi-cli-exit-0.2.0-rc-2023-11-05';
import { WasiCliStderr020rc20231105 } from './interfaces/wasi-cli-stderr-0.2.0-rc-2023-11-05';
import { WasiCliStdin020rc20231105 } from './interfaces/wasi-cli-stdin-0.2.0-rc-2023-11-05';
import { WasiCliStdout020rc20231105 } from './interfaces/wasi-cli-stdout-0.2.0-rc-2023-11-05';
import { WasiCliTerminalInput020rc20231105 } from './interfaces/wasi-cli-terminal-input-0.2.0-rc-2023-11-05';
import { WasiCliTerminalOutput020rc20231105 } from './interfaces/wasi-cli-terminal-output-0.2.0-rc-2023-11-05';
import { WasiCliTerminalStderr020rc20231105 } from './interfaces/wasi-cli-terminal-stderr-0.2.0-rc-2023-11-05';
import { WasiCliTerminalStdin020rc20231105 } from './interfaces/wasi-cli-terminal-stdin-0.2.0-rc-2023-11-05';
import { WasiCliTerminalStdout020rc20231105 } from './interfaces/wasi-cli-terminal-stdout-0.2.0-rc-2023-11-05';
import { WasiClocksWallClock020rc20231105 } from './interfaces/wasi-clocks-wall-clock-0.2.0-rc-2023-11-05';
import { WasiFilesystemPreopens020rc20231105 } from './interfaces/wasi-filesystem-preopens-0.2.0-rc-2023-11-05';
import { WasiFilesystemTypes020rc20231105 } from './interfaces/wasi-filesystem-types-0.2.0-rc-2023-11-05';
import { WasiIoStreams020rc20231105 } from './interfaces/wasi-io-streams-0.2.0-rc-2023-11-05';
import { WasiRandomRandom020rc20231105 } from './interfaces/wasi-random-random-0.2.0-rc-2023-11-05';
import { WasiSocketsTcp020rc20231105 } from './interfaces/wasi-sockets-tcp-0.2.0-rc-2023-11-05';
export function stubWasi(engine: Uint8Array, stdout: boolean): Uint8Array;
export function spliceBindings(sourceName: string | undefined, spidermonkeyEngine: Uint8Array, witWorld: string | undefined, witPath: string | undefined, worldName: string | undefined): SpliceResult;
