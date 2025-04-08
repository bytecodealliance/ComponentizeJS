use std::path::PathBuf;

use anyhow::Result;
use wasmtime::{
    component::{Component, Linker},
    Config, Engine, Store, WasmBacktraceDetails,
};
use wasmtime_wasi::{IoView, ResourceTable, WasiCtx, WasiCtxBuilder, WasiView};
use wasmtime_wasi_http::{WasiHttpCtx, WasiHttpView};

mod bindings {
    // This macro produces generated code that is used to link
    // the functionality exposed by the component, and eventually
    // call it.
    wasmtime::component::bindgen!({
        world: "component",
        path: "../guest/hello.wit",
        async: true
    });
}

// Default path to the WebAsssembly component as generated in the 'guest' folder,
// facilitating `cargo run` from the 'host' directory.
//
// If this binary is compiled and used from another folder, this path will likely be invalid,
// and in that case, using the `COMPONENT_PATH` environment variable is preferred.
const DEFAULT_COMPONENT_PATH: &str = "../guest/hello.component.wasm";

#[async_std::main]
async fn main() -> Result<()> {
    let mut builder = WasiCtxBuilder::new();
    builder.inherit_stdio();
    let table = ResourceTable::new();
    let wasi = builder.build();

    let mut config = Config::new();
    config.cache_config_load_default().unwrap();
    config.wasm_backtrace_details(WasmBacktraceDetails::Enable);
    config.wasm_component_model(true);
    config.async_support(true);

    let engine = Engine::new(&config)?;
    let mut linker = Linker::new(&engine);

    let component_path = std::env::var("COMPONENT_WASM_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(DEFAULT_COMPONENT_PATH));
    let component = Component::from_file(&engine, component_path).unwrap();

    struct CommandExtendedCtx {
        table: ResourceTable,
        wasi: WasiCtx,
        http: WasiHttpCtx,
    }
    impl IoView for CommandExtendedCtx {
        fn table(&mut self) -> &mut ResourceTable { &mut self.table }
    }
    impl WasiView for CommandExtendedCtx {
        fn ctx(&mut self) -> &mut WasiCtx {
            &mut self.wasi
        }
    }
    impl WasiHttpView for CommandExtendedCtx {
        fn ctx(&mut self) -> &mut WasiHttpCtx {
            &mut self.http
        }
    }

    wasmtime_wasi::add_to_linker_sync(&mut linker)?;
    wasmtime_wasi_http::add_only_http_to_linker_sync(&mut linker)?;
    let mut store = Store::new(
        &engine,
        CommandExtendedCtx {
            table,
            wasi,
            http: WasiHttpCtx::new(),
        },
    );

    let hello = bindings::Component::instantiate_async(&mut store, &component, &linker).await?;
    let res = hello.call_hello(&mut store, "ComponentizeJS").await?;
    println!("{}", res);
    Ok(())
}
