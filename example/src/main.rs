use anyhow::Result;
use wasmtime::{
    component::{Component, Linker},
    Config, Engine, Store, WasmBacktraceDetails,
};
use wasmtime_wasi::{command, ResourceTable, WasiCtx, WasiCtxBuilder, WasiView};
use wasmtime_wasi_http::{proxy, WasiHttpCtx, WasiHttpView};

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
        wasi_http: WasiHttpCtx,
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
            &mut self.wasi_http
        }
    }

    let wasi_http = WasiHttpCtx;

    command::add_to_linker(&mut linker)?;
    proxy::add_only_http_to_linker(&mut linker)?;
    let mut store = Store::new(
        &engine,
        CommandExtendedCtx {
            table,
            wasi,
            wasi_http,
        },
    );

    let (instance, _instance) = Hello::instantiate_async(&mut store, &component, &linker).await?;

    let res = instance.call_hello(&mut store, "ComponentizeJS").await?;
    println!("{}", res);
    Ok(())
}
