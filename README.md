<div align="center">
  <h1><code>ComponentizeJS</code></h1>

  <p>
    <strong>ESM -> WebAssembly Component creator,<br />via a SpiderMonkey JS engine embedding</a></strong>
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
  export function hello (name) {
    return \`Hello \${name}\`;
  }
`, `
  package local:hello;
  world hello {
    export hello: func(name: string) -> string;
  }
`, {
  // recommended to get error debugging
  // disable to get a "pure component" without WASI imports
  enableStdout: true
});

await writeFile('test.component.wasm', component);
```

The component iself can be executed in any component runtime, see the [example](EXAMPLE.md) for a full workflow.

## Features

The set of enabled features in the engine can be customized depending on the target world and expected capabilities.

The default set of features includes:

* `'stdio'`: Output to stderr and stdout for errors and console logging, depends on `wasi:cli` and `wasi:io`.
* `'random'`: Support for cryptographic random, depends on `wasi:random`. **When disabled, random numbers will still be generated but will not be random and instead fully deterministic.**
* `'clocks'`: Support for clocks and duration polls, depends on `wasi:clocks` and `wasi:io`. **When disabled, using any timer functions like setTimeout or setInterval will panic.**

Setting `disableFeatures: ['random', 'stdio', 'clocks']` will disable all features creating a minimal "pure component", that does not depend on any WASI APIs at all and just the target world.

Note that pure components **will not report errors and will instead trap**, so that this should only be enabled after very careful testing.

Note that features explicitly imported by the target world cannot be disabled - if you target a component to a world
that imports `wasi:clocks`, then `disableFeatures: ['clocks']` will not be supported.

## API

```ts
export function componentize(jsSource: string, opts: {
  witPath: string,
  worldName: string,
  debug?: bool,
  sourceName?: string,
  engine?: string,
  preview2Adapter?: string,
  disableFeatures?: ('stdio' | 'random' | 'clocks')[],
}): {
  component: Uint8Array,
  imports: string[]
}
```

Converts a JS source into a component binary.

## Contributing

### Pre-requisites

* `git submodule update --init --recursive` to update the submodules.
* Stable Rust with the `wasm32-unknown-unknown` and `wasm32-wasi` targets
  installed.
* `wasi-sdk-20.0` installed at `/opt/wasi-sdk/`

### Building and testing

Building and testing is based on a `npm install && npm run build && npm run test` workflow.

# License

This project is licensed under the Apache 2.0 license with the LLVM exception.
See [LICENSE](LICENSE) for more details.

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this project by you, as defined in the Apache-2.0 license,
shall be licensed as above, without any additional terms or conditions.
