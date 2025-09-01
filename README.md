<div align="center">
  <h1><code>ComponentizeJS</code></h1>

  <p>
    <strong>ESM -> WebAssembly Component creator,<br />via a SpiderMonkey JS engine embedding</strong>
  </p>

  <strong>A <a href="https://bytecodealliance.org/">Bytecode Alliance</a> project</strong>

  <p>
    <a href="https://github.com/bytecodealliance/jco/actions?query=workflow%3ACI"><img src="https://github.com/bytecodealliance/jco/workflows/CI/badge.svg" alt="build status" /></a>
  </p>
</div>

## Overview

Provides a Mozilla SpiderMonkey embedding that takes as input a JavaScript source file and a WebAssembly Component [WIT World](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md),
and outputs a [WebAssembly Component](https://github.com/WebAssembly/component-model) binary with the same interface.

> **Note**: This is an experimental project, no guarantees are provided for stability or support and breaking changes may be made in future.

## Example

See the end-to-end example workflow for [creating a JS component and running it in Wasmtime or Node.js](EXAMPLE.md).

## Explainer

For background on the concepts involved, see https://bytecodealliance.org/articles/making-javascript-run-fast-on-webassembly.

The goal of this project specifically is to provide a comprehensive dynamic bindings system for creating arbitrary WebAssembly Components from JavaScript. That is, to provide full flexibility over the resultant JS environment and WIT World.

### Wizer Pre-Initialization

Adaption follows the standard [Wizer technique](https://github.com/bytecodealliance/wizer) in pre-initializing a snapshot of the runtime against the source and bindings.

The snapshotting process executes the JS engine initialization, globals and parsing and compiling of the source code. Currently we also evaluate the top-level of the source so that the executed exports of the top-level ES module are provided already initialized.

As a result, at runtime - only the  bytecode is being executed, without any initialization costs. _This makes on-demand Wasm execution of JS incredibly fast._

### SpiderMonkey Embedding

As a dynamic language with quirks, JavaScript cannot be compiled directly into bytecode without including a comprehensive ECMA-262 spec-compliant runtime engine. Componentization of JavaScript thus involves embedding the JS runtime engine into the component itself.

SpiderMonkey is chosen here as a JS engine with first-class WASI build support, using an embedding of the [StarlingMonkey Wasm engine](https://github.com/fermyon/StarlingMonkey). The total embedding size is around 8MB.

One of the security benefits of the component model is complete code isolation apart from the shared-nothing code boundaries between components. By fully encapsulating the engine embedding for each individual component, this maintains comprehensive per-component isolation.

As more components are written in JavaScript, and there exist scenarios where multiple JS components are communicating in the same application, the plan for optimization here is to share the SpiderMonkey engine embedding between them. This can be done without breaking the shared-nothing semantics by having the engine itself loaded as a shared library of the components. Sharing functions via same SpiderMonkey build, not memory.

Establishing this initial prototype as a singular flexible engine foundation that can be turned into a shared library is therefore the focus for this project.

## Platform APIs

The following APIs are available:

* **Legacy Encoding**: `atob`, `btoa`, `decodeURI`, `encodeURI`, `decodeURIComponent`, `encodeURIComponent`
* **Streams**: `ReadableStream`, `ReadableStreamBYOBReader`, `ReadableStreamBYOBRequest`, `ReadableStreamDefaultReader`, `ReadableStreamDefaultController`, `ReadableByteStreamController`, `WritableStream` `ByteLengthQueuingStrategy` `CountQueuingStrategy`, `TransformStream`
* **URL**: `URL` `URLSearchParams`
* **Console**: `console`
* **Performance**: `Performance`
* **Task**: `queueMicrotask`, `setInterval` `setTimeout` `clearInterval` `clearTimeout`
* **Location**: `WorkerLocation`, `location`
* **Encoding**: `TextEncoder`, `TextDecoder`, `CompressionStream`, `DecompressionStream`
* **Structured Clone**: `structuredClone`
* **Fetch**: `fetch` `Request` `Response` `Headers`
* **Forms, Files, and Blobs**: `FormData`, `MultipartFormData`, `File`, `Blob`
* **Crypto**: `SubtleCrypto` `Crypto` `crypto` `CryptoKey`

## Usage

Install and run as a Node.js library:

```shell
npm install @bytecodealliance/componentize-js
```

```js
import { componentize } from '@bytecodealliance/componentize-js';
import { writeFile } from 'node:fs/promises';

const { component } = await componentize(`
  import { log } from 'local:hello/logger';

  export function sayHello (name) {
    log(\`Hello \${name}\`);
  }

`, `
  package local:hello;
  interface logger {
    log: func(msg: string);
  }
  world hello {
    import logger;
    export say-hello: func(name: string);
  }
`);

await writeFile('test.component.wasm', component);
```

See [types.d.ts](types.d.ts) for the full interface options.

The component itself can be executed in any component runtime, see the [example](EXAMPLE.md) for an end to end workflow in Wasmtime.

### Custom `wizer` binary

To use a custom (pre-downloaded) [`wizer`](https://github.com/bytecodealliance/wizer) binary, set the `wizerBin` option to the path to your desired wizer binary.

### Async Support

To support asynchronous operations, all functions may optionally be written as sync or async functions, even though they will always be turned into sync component functions.

For example, to use `fetch` which requires async calls, we can write the same example component using an async function:

```js
export async function sayHello (name) {
  const text = await (await fetch(`http://localhost:8080/${name}`)).text();
  console.log(text);
}
```

ComponentizeJS will automatically resolve promises returned by functions to syncify their return values, running the event loop within the JS component to resolution.

This asynchrony is only supported for exported functions - imported functions can only be synchronous pending component-model-level async support.

### CLI

ComponentizeJS can be used as a CLI directly, or via the `jco componentize` command:

#### Direct use
```
npm install -g @bytecodealliance/componentize-js
```

Example:

```sh
componentize-js --wit wit -o component.wasm source.js
```

See `jco componentize --help` for more details.

#### Use via `jco componentize`
```
npm install -g @bytecodealliance/jco @bytecodealliance/componentize-js
```

Example:

```sh
jco componentize source.js --wit wit -o component.wasm
```

See `jco componentize --help` for more details.

## Features

The set of enabled features in the engine can be customized depending on the target world and expected capabilities.

The default set of features includes:

* `'stdio'`: Output to stderr and stdout for errors and console logging, depends on `wasi:cli` and `wasi:io`.
* `'random'`: Support for cryptographic random, depends on `wasi:random`. **When disabled, random numbers will still be generated but will not be random and instead fully deterministic.**
* `'clocks'`: Support for clocks and duration polls, depends on `wasi:clocks` and `wasi:io`. **When disabled, using any timer functions like setTimeout or setInterval will panic.**
* `'http'`: Support for outbound HTTP via the `fetch` global in JS.
* `'fetch-event'`: Support for `fetch` based incoming request handling (i.e. `addEventListener('fetch', ...)`)

Setting `disableFeatures: ['random', 'stdio', 'clocks', 'http', 'fetch-event']` will disable all features creating a minimal "pure component", that does not depend on any WASI APIs at all and just the target world.

Note that pure components **will not report errors and will instead trap**, so that this should only be enabled after very careful testing.

Note that features explicitly imported by the target world cannot be disabled - if you target a component to a world that imports `wasi:clocks`, then `disableFeatures: ['clocks']` will not be supported.

Note that depending on your component implementation, some features may be automatically disabled. For example, if using
`wasi:http/incoming-handler` manually, the `fetch-event` cannot be used.

## Using StarlingMonkey's `fetch-event`

The StarlingMonkey engine provides the ability to use `fetchEvent` to handle calls to `wasi:http/incoming-handler@0.2.0#handle`.

When targeting worlds that export `wasi:http/incoming-handler@0.2.0` the fetch event will automatically be attached. Alternatively,
to override the fetch event with a custom handler, export an explicit `incomingHandler` or `'wasi:http/incoming-handler@0.2.0'`
object. Using the `fetchEvent` requires enabling the `http` feature.

> [!WARNING]
> If using `fetch-event`, ensure that you *do not* manually import (i.e. exporting `incomingHandler` from your ES module).
>
> Modules that export `incomingHandler` and have the `http` feature enabled are assumed to be using `wasi:http` manually.

## API

```ts
export function componentize(opts: {
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
   * Pass environment variables to the spawned Wizer Process
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
    /**  Path    to enable binary-specific debugging */
    binaryPath?: string;
    /** Whether to enable wizer logging */
    wizerLogging: false;
  }
}): Promise<{
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
}>
```

Converts a JS source into a component binary.

Imports provides the list of used guest imports only, while the StarlingMonkey engine may pull in additional
imports. Direct component analysis should be used to correctly infer the real imports list.

## Contributing

To contribute, you'll need to set up the following:

* `git submodule update --init --recursive` to update the submodules.
* Stable Rust with the `wasm32-unknown-unknown` and `wasm32-wasi` targets
  installed.
* `wasi-sdk-20.0` installed at `/opt/wasi-sdk/`

## Building

Building and testing the project can be performed via NPM scripts (see [`package.json`](./package.json)):

```console
npm install
npm run build
```

To clean up a local installation (i.e. remove the installation of StarlingMonkey):

```console
npm run clean
```

## Testing

To run all tests:

```console
npm run test
```

### Running a specific test

To run a specific test suite, you can pass an argument to [`vitest`][vitest]:

```console
npm run test -- test/wasi.js
```

[vitest]: https://vitest.dev

# License

This project is licensed under the Apache 2.0 license with the LLVM exception.
See [LICENSE](LICENSE) for more details.

## Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this project by you, as defined in the Apache-2.0 license,
shall be licensed as above, without any additional terms or conditions.
