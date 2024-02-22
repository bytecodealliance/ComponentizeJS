use anyhow::Result;
use wasmtime::{
    component::{Component, Linker},
    Config, Engine, Store, WasmBacktraceDetails,
};
use wasmtime_wasi::preview2::{WasiCtxBuilder, ResourceTable, WasiCtx, WasiView, command::add_to_linker};

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

    struct CommandCtx {
        table: ResourceTable,
        wasi: WasiCtx,
    }
    impl WasiView for CommandCtx {
        fn table(&self) -> &ResourceTable {
            &self.table
        }
        fn table_mut(&mut self) -> &mut ResourceTable {
            &mut self.table
        }
        fn ctx(&self) -> &WasiCtx {
            &self.wasi
        }
        fn ctx_mut(&mut self) -> &mut WasiCtx {
            &mut self.wasi
        }
    }

    add_to_linker(&mut linker)?;
    let mut store = Store::new(
        &engine,
        CommandCtx {
            table,
            wasi,
        },
    );

    let (instance, _instance) =
        Hello::instantiate_async(&mut store, &component, &linker).await?;

    let res = instance.call_hello(&mut store, "ComponentizeJS").await?;
    println!("{}", res);
    Ok(())
}
