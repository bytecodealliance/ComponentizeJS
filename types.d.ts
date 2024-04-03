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
   */
  disableFeatures?: ('stdio' | 'random' | 'clocks')[],
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
   * Available component world imports to the componentized JavaScript (whether used or not)
   */
  imports: [[string, string]][]
}
