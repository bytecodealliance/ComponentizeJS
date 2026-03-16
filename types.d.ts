interface ComponentizeOptions {
  /**
   * The path to the file to componentize.
   *
   * This file must be a valid JavaScript module, and can import other modules using relative paths.
   */
  sourcePath: string;
  /**
   * Path to WIT file or folder
   */
  witPath?: string;
  /**
   * Target world name for componentization
   */
  worldName?: string;
  /**
   * Path to custom ComponentizeJS engine build to use
   */
  engine?: string;
  /**
   * Path to custom weval cache to use
   */
  aotCache?: string;
  /**
   * Enable AoT using weval
   */
  enableAot?: boolean;
  /**
   * Use a pre-existing path to the `weval` binary, if present
   */
  wevalBin?: string;
  /**
   * Use a pre-existing path to the `wizer` binary, if present
   */
  wizerBin?: string;
  /**
   * Path to custom Preview2 Adapter
   */
  preview2Adapter?: string;
  /**
   * Disable WASI features in the base engine
   * Disabling all features results in a pure component with no WASI dependence
   *
   * - stdio: console.log(), console.error and errors are provided to stderr
   * - random: Math.random() and crypto.randomBytes()
   * - clocks: Date.now(), performance.now()
   * - http: fetch() support
   *
   */
  disableFeatures?: ('stdio' | 'random' | 'clocks' | 'http' | 'fetch-event')[];
  /**
   * Enable WASI features in the base engine
   * (no experimental subsystems currently supported)
   */
  enableFeatures?: [];
  /**
   * Pass environment variables to the spawned Wizer or Weval Process
   * If set to true, all host environment variables are passed
   * To pass only a subset, provide an object with the desired variables
   */
  env?: boolean | Record<string, string>;
  /**
   * Runtime arguments to provide to the StarlingMonkey engine initialization
   * (see https://github.com/bytecodealliance/StarlingMonkey/blob/main/include/config-parser.h)
   */
  runtimeArgs?: string;
  /**
   * Use a debug build
   * Note that the debug build only includes the names section only for size optimization, and not DWARF
   * debugging sections, due to a lack of support in Node.js for these debugging workflows currently.
   */
  debugBuild?: boolean;
  /**
   * Debug options
   */
  debug?: {
    /**  Whether to enable bindings-specific debugging */
    bindings?: boolean;
    /**  Path to debug bindings to use */
    bindingsDir?: string;
    /**  Whether to enable binary-specific debugging */
    binary?: boolean;
    /**  Path to the binary that was output */
    binaryPath?: string;
    /** Whether to enable wizer logging */
    wizerLogging: false;
  };
}

/**
 * Componentize a JavaScript module to a WebAssembly component
 *
 * @param opts Componentize options
 */
export function componentize(
  opts: ComponentizeOptions,
): Promise<ComponentizeOutput>;

/**
 * @deprecated Use `componentize(opts)` instead
 *
 * @param source Source code of JavaScript module to componentize
 * @param opts Componentize options
 */
export function componentize(
  source: string,
  opts: ComponentizeOptions,
): Promise<ComponentizeOutput>;

/**
 * @deprecated Use `componentize(opts)` instead
 *
 * @param source Source code of JavaScript module to componentize
 * @param witWorld Inline WIT string to componentize to
 * @param opts Componentize options
 */
export function componentize(
  source: string,
  witWorld: string,
  opts?: ComponentizeOptions,
): Promise<ComponentizeOutput>;

interface ComponentizeOutput {
  /**
   * Component binary
   */
  component: Uint8Array;
  /**
   * Used guest imports in JavaScript (excluding those from StarlingMonkey engine)
   */
  imports: [[string, string]][];
  /**
   * Debugging output (only present if enabled)
   */
  debug?: {
    /** Whether bindings debugging was enabled */
    bindings?: boolean;
    /** Work directory used during processing */
    workDir?: string;
    /** Whether binary debugging was enabled */
    binary?: boolean;
    /** Path to the produced binary */
    binaryPath?: string;
  };
}

/**
 * ComponentizeJS version string
 */
export const version: string;
