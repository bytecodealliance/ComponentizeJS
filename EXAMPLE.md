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

componentize.mjs
```js
import { componentize } from '@bytecodealliance/componentize-js';
import { readFile, writeFile } from 'node:fs/promises';

const jsSource = await readFile('hello.js', 'utf8');
const witSource = await readFile('hello.wit', 'utf8');

const { component } = await componentize(jsSource, witSource);

await writeFile('hello.component.wasm', component);
```

Run this with Node to build `hello.component.wasm`:

```
node componentize.mjs
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
cap-std = "1.0.12"
wasmtime = { git = "https://github.com/bytecodealliance/wasmtime", rev = "299131ae2d6655c49138bfab2c4469650763ef3b", features = ["component-model"] }
wasi-common =  { git = "https://github.com/bytecodealliance/preview2-prototyping", rev = "dd34a00d4386000cd00071cff18b9e3a12788075" }
wasi-cap-std-sync = { git = "https://github.com/bytecodealliance/preview2-prototyping", rev = "dd34a00d4386000cd00071cff18b9e3a12788075" }
wasmtime-wasi-sockets =  { git = "https://github.com/bytecodealliance/preview2-prototyping", rev = "dd34a00d4386000cd00071cff18b9e3a12788075" }
wasmtime-wasi-sockets-sync = { git = "https://github.com/bytecodealliance/preview2-prototyping", rev = "dd34a00d4386000cd00071cff18b9e3a12788075" }
```

src/main.rs
```rs
use anyhow::Result;
use wasi_cap_std_sync::WasiCtxBuilder;
use wasi_common::{wasi, Table, WasiCtx, WasiView};
use wasmtime::{
    component::{Component, Linker},
    Config, Engine, Store, WasmBacktraceDetails,
};
use wasmtime_wasi_sockets::{WasiSocketsCtx, WasiSocketsView};
use wasmtime_wasi_sockets_sync::WasiSocketsCtxBuilder;

wasmtime::component::bindgen!({
    world: "hello",
    path: "hello.wit",
    async: true
});

#[async_std::main]
async fn main() -> Result<()> {
    let builder = WasiCtxBuilder::new().inherit_stdio();
    let mut table = Table::new();
    let wasi = builder.build(&mut table)?;

    let mut config = Config::new();
    config.cache_config_load_default().unwrap();
    config.wasm_backtrace_details(WasmBacktraceDetails::Enable);
    config.wasm_component_model(true);
    config.async_support(true);

    let engine = Engine::new(&config)?;
    let mut linker = Linker::new(&engine);

    let component = Component::from_file(&engine, "hello.component.wasm").unwrap();


    struct CommandCtx {
        table: Table,
        wasi: WasiCtx,
        sockets: WasiSocketsCtx,
    }
    impl WasiView for CommandCtx {
        fn table(&self) -> &Table {
            &self.table
        }
        fn table_mut(&mut self) -> &mut Table {
            &mut self.table
        }
        fn ctx(&self) -> &WasiCtx {
            &self.wasi
        }
        fn ctx_mut(&mut self) -> &mut WasiCtx {
            &mut self.wasi
        }
    }
    let sockets = WasiSocketsCtxBuilder::new()
        .inherit_network(cap_std::ambient_authority())
        .build();
    impl WasiSocketsView for CommandCtx {
        fn table(&self) -> &Table {
            &self.table
        }
        fn table_mut(&mut self) -> &mut Table {
            &mut self.table
        }
        fn ctx(&self) -> &WasiSocketsCtx {
            &self.sockets
        }
        fn ctx_mut(&mut self) -> &mut WasiSocketsCtx {
            &mut self.sockets
        }
    }

    wasi::command::add_to_linker(&mut linker)?;
    let mut store = Store::new(
        &engine,
        CommandCtx {
            table,
            wasi,
            sockets,
        },
    );

    let (instance, _instance) =
        Hello::instantiate_async(&mut store, &component, &linker).await?;

    let res = instance.call_hello(&mut store, "ComponentizeJS").await?;
    println!("{}", res);
    Ok(())
}
```

Building and running the binary should print the result:

```
cargo build --release
./target/release/wasmtime-test
> Hello ComponentizeJS
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

Create package.json in the *hello* folder

```npm init
```

Append the below line to the package.json file that was just created.

```
"type": "module",
```

This is added to ensure all .js and .mjs files are interpreted as ES modules. 

In the absence of this, you may receive the following error SyntaxError: Cannot use import statement outside a module

To test the component:

```
node -e "import('./hello/hello.component.js').then(m => console.log(m.hello('ComponentizeJS')))"
> Hello ComponentizeJS
```
