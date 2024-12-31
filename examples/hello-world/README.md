# Example Javascript component

This folder contains an example Javascript project that uses `componentize-js`
as a library to build a basic [WebAssembly component][cm-book].

[cm-book]: https://component-model.bytecodealliance.org/

## Overview

This folder contains *two* codebases:

- `guest` contains the Javascript WebAssembly Component
- `host` contains a Rust host that has been configured to run the component

### `guest` - A WebAssembly component written in Javascript

The [WebAssembly Interface Types ("WIT")][wit] interface ([`hello.wit`](./guest/hello.wit)) for the component is:

```wit
package local:hello;

world component {
  export hello: func(name: string) -> string;
}
```

A Javascript (ES) module that conforms to the interface shown above looks like the following:

```js
export function hello (name) {
  return `Hello ${name}`;
}
```

> [!NOTE]
> The ES module is assumed implicitly to *be* the targeted `world`.
>
> This means that the JS export of the `hello` function maps to the
> WIT `hello` `export` of the `component` world.
>
> The world does not have to be called `component`.

See [`hello.js`](./guest/hello.js) for the full code listing.

We call the produced WebAssembly component "guest" as it is code that will run on
the WebAssembly virtual machine/runtime.

[wit]: https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md

## `host` - A WebAssembly runtime embedding written in Rust

Since our component does not export a standardized way to run it (in this case,
the standard we *could* have used would be [WASI CLI][wasi-cli]), we must use a custom host which
embeds a WebAssembly runtime ([`wasmtime`][wasmtime] in this case) to run the WebAssembly Component.

`wasmtime` is easiest to use from [Rust][rust], so we have the `host` that contains
setup code which enables use of the component we wrote, and calls it.

See [`host/src/main.rs`](./host/src/main.rs) for the full code listing.

[wasmtime]: https://github.com/bytecodealliance/wasmtime
[wasi-cli]: https://github.com/WebAssembly/wasi-cli
[rust]: https://rust-lang.org

## Build the component

To build the WebAssembly component, enter the `guest` directory and install dependencies:

```console
npm install
```

Then either run the `componentize.js` script directly:

```console
node componentize.js
```

Or use the pre-configured `build` script:

```console
npm run build
```

## Run the component

### Via automation

To run the component and test it's output, use the included bash script:

```console
./test.sh
```

### Manually

To run the component manually, we must run our custom `wasmtime` embedding manually.

First enter the `host` directory and use `cargo run`:

```console
cargo run
```

## Common Issues

### No such file or directory

If you get an error that looks like the following:

```
thread 'main' panicked at src/main.rs:39:67:
called `Result::unwrap()` on an `Err` value: failed to read from `../../guest/hello.component.wasm`

Caused by:
    No such file or directory (os error 2)
```

This means that the default path (which is relative, and embedded in the binary) to the component
produced by the `guest` is not present.

To fix this, specify `COMPONENT_WASM_PATH` as an environment variable before `cargo run`:

```console
COMPONENT_WASM_PATH=/absolute/path/to/hello.component.wasm cargo run
```

If you're running the produced `wasmtime-test` binary itself:

```console
COMPONENT_WASM_PATH=/absolute/path/to/hello.component.wasm path/to/wasmtime-test
```
