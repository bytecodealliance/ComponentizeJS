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

SpiderMonkey is chosen here as a JS engine with first-class WASI build support. The total embedding size is around 5MB.

One of the security benefits of the component model is complete code isolation apart from the shared-nothing code boundaries between components. By fully encapsulating the engine embedding for each individual component, this maintains comprehensive per-component isolation.

As more components are written in JavaScript, and there exist scenarios where multiple JS components are communicating in the same application, the plan for optimization here is to share the SpiderMonkey engine embedding between them. This can be done without breaking the shared-nothing semantics by having the engine itself loaded as a shared library of the components. Sharing functions via same SpiderMonkey build, not memory.

Establishing this initial prototype as a singular flexible engine foundation that can be turned into a shared library is therefore the focus for this project.

## Native Functions

In addition to the spec-compliant JS engine intrinsics, the following non-JS global APIs are also available:

* `console`
* `TextEncoder`
* `TextDecoder`
* `URL`

Extending support for standard globals is a work-in-progress.

Custom globals can be custom implemented via a JS prelude script to set up any custom globals as part of the JS code being componentized. These global functions can in turn call component imports if underlying host-native functions are needed. Since JS code is pre-initialized any top-level prelude scripts will be preinitialized as part of the initial component build so that this does not result in any runtime work.

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
`);

await writeFile('test.component.wasm', component);
```

The component iself can be executed in any component runtime, see the [example](EXAMPLE.md) for a full workflow.

## Console Support

By default, `console.log` calls will not write to `stdout`, unless explicitly configured by the `enableStdout: true` option.

In future this will use the WASI logging subsystem directly.

## API

```js
componentize(jsSource: string, {
  witPath: string,
  worldName: string,
  debug?: bool,
  sourceName?: string,
  engine?: string,
  preview2Adapter?: string,
  enableStdout?: bool,
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
* `cbindgen`, which can be installed via `cargo install --force cbindgen`
* `wget`, in macOS can be installed via `brew install wget`
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
