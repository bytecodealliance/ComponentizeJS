# ComponentizeJS Example

this example showcases function imports and exports with a Rust wasmtime host and a js guest

### Building the Component

```bash
# install componentize-js
npm install
# build the component. The filename will be hello.component.wasm
node build.mjs
```

### Running the Component

```bash
cargo run --release
```

see `src/main.rs` to learn how to implement host functions and how to call js functions
and `hello.js` to learn how to export js functions and how to import and call host functions
