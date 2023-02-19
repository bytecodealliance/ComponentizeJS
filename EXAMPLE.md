# ComponentizeJS Example

### Creating the Component

Given a world that descibes a component interface:

hello.wit
```
default world hello {
  export hello: func(name: string) -> string
}
```

Write a JS file that adheres to the same interface:

hello.js
```js
export function hello (name) {
  return `Hello ${name}`;
}
```

The component can then be built with the `componentize` API:

```js
import { componentize } from '@bytecodealliance/componentize-js';
import { readFile, writeFile } from 'node:fs/promises';

const jsSource = await readFile('hello.js', 'utf8');
const witSource = await readFile('hello.wit', 'utf8');

const { component } = await componentize(jsSource, witSource);

await writeFile('hello.component.wasm', component);
```

### Running the Component in Wasmtime

Cargo.toml
```toml
[package]
name = "wasmtime-test"
version = "0.1.0"
edition = "2021"

# See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html

[workspace]

[dependencies]
anyhow = "1.0.65"
async-std = { version = "1.12.0", features = ["attributes"] }
wasmtime = { git = "https://github.com/bytecodealliance/wasmtime", features = ["component-model"], branch = 'release-6.0.0' }
host = { git = "https://github.com/bytecodealliance/preview2-prototyping" }
wasi-common =  { git = "https://github.com/bytecodealliance/preview2-prototyping" }
wasi-cap-std-sync = { git = "https://github.com/bytecodealliance/preview2-prototyping" }
```

src/main.rs
```rs
use anyhow::Result;
use host::add_to_linker;
use wasi_cap_std_sync::WasiCtxBuilder;
use wasmtime::{
    component::{Component, Linker},
    Config, Engine, Store, WasmBacktraceDetails,
};

wasmtime::component::bindgen!({
    world: "hello",
    path: "../hello.wit",
    async: true
});

#[async_std::main]
async fn main() -> Result<()> {
    let mut config = Config::new();
    config.cache_config_load_default().unwrap();
    config.wasm_backtrace_details(WasmBacktraceDetails::Enable);
    config.wasm_component_model(true);
    config.async_support(true);
    
    let engine = Engine::new(&config).unwrap();
    let mut linker = Linker::new(&engine);
    add_to_linker(&mut linker, |x| x).unwrap();

    let mut store = Store::new(
        &engine,
        WasiCtxBuilder::new()
            .inherit_stdin()
            .inherit_stdout()
            .build(),
    );

    let component = Component::from_file(&engine, "../hello.component.wasm").unwrap();

    // after getting the component, we can instantiate a markdown instance.
    let (instance, _instance) = Hello::instantiate_async(&mut store, &component, &linker).await?;
    let res = instance.call_hello(&mut store, "ComponentizeJS").await?;
    println!(res);
    Ok(())
}
```

Building and running the binary should print the result:

```
cargo build --release
./target/release/wasmtime-test
> Hello CompontizeJS
```

### Running the Component in Node.js

To run the component in Node.js, we need to first transpile the component with `jco`:

```
npm install -g @bytecodealliance/jco
```

Transpile the component:

```
jco transpile hello.component.wasm -o hello --map 'wasi-*=@bytecodealliance/preview2-shim/*'
```

The custom WASI mapping argument allows us to direct the WASI component imports to the experimental JS WASI shim.

We can install this shim itself from npm as well:

```
npm install @bytecodealliance/preview2-shim
```

To test the component:

```
node -e "import('./hello/hello.component.js').then(m => console.log(m.hello('ComponentizeJS')))"
> Hello ComponentizeJS
```
