use anyhow::Result;
use wasmtime::{
    component::{Component, Linker},
    Config, Engine, Store, WasmBacktraceDetails,
};
use wasmtime_wasi::{ResourceTable, WasiCtx, WasiCtxBuilder, WasiView};
use wasmtime_wasi_http::{WasiHttpCtx, WasiHttpView};

wasmtime::component::bindgen!({
    world: "hello",
    path: "hello.wit",
    async: true
});

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

    let component = Component::from_file(&engine, "hello.component.wasm").unwrap();

    struct CommandExtendedCtx {
        table: ResourceTable,
        wasi: WasiCtx,
        http: WasiHttpCtx,
    }
    impl WasiView for CommandExtendedCtx {
        fn table(&mut self) -> &mut ResourceTable {
            &mut self.table
        }
        fn ctx(&mut self) -> &mut WasiCtx {
            &mut self.wasi
        }
    }
    impl WasiHttpView for CommandExtendedCtx {
        fn table(&mut self) -> &mut ResourceTable {
            &mut self.table
        }
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

    let hello = Hello::instantiate_async(&mut store, &component, &linker).await?;
    let res = hello.call_hello(&mut store, "ComponentizeJS").await?;
    println!("{}", res);
    Ok(())
}
