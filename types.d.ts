interface ComponentizeOptions {
  /**
   * Source name for debugging
   */
  sourceName?: string,
  /**
   * Path to custom ComponentizeJS engine build to use
   */
  engine?: string,
  /**
   * Path to custom weval cache to use
   */
  aotCache?: string,
  /**
   * Enable AoT using weval
   */
  enableAot?: boolean,
  /**
   * Use a pre-existing path to the `weval` binary, if present
   */
  wevalBin?: string,
  /**
   * Path to custom Preview2 Adapter
   */
  preview2Adapter?: string,
  /**
   * Path to WIT file or folder
   */
  witPath?: string,
  /**
   * Target world name for componentization
   */
  worldName?: string,
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
  disableFeatures?: ('stdio' | 'random' | 'clocks' | 'http')[],
  /**
   * Enable WASI features in the base engine
   * (no experimental subsystems currently supported)
   */
  enableFeatures?: [],
  /**
   * Pass environment variables to the spawned Wizer or Weval Process
   * If set to true, all host environment variables are passed
   * To pass only a subset, provide an object with the desired variables
   */
  env?: boolean | Record<string, string>,
  /**
   * Runtime arguments to provide to the StarlingMonkey engine initialization
   * (see https://github.com/bytecodealliance/StarlingMonkey/blob/main/include/config-parser.h)
   */
  runtimeArgs?: string,
}

/**
 * @param source JavaScript module to componentize
 * @param opts Componentize options
 */
export function componentize(source: string, opts: ComponentizeOptions): Promise<ComponentizeOutput>
/**
 * 
 * @param source JavaScript module to componentize
 * @param witWorld Inline WIT string to componentize to
 * @param opts Componentize options
 */
export function componentize(source: string, witWorld: string, opts?: ComponentizeOptions): Promise<ComponentizeOutput>

interface ComponentizeOutput {
  /**
   * Component binary
   */
  component: Uint8Array,
  /**
   * Used guest imports in JavaScript (excluding those from StarlingMonkey engine)
   */
  imports: [[string, string]][]
}
