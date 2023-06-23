use anyhow::Result;
use wasmtime::{
    component::{Component, Linker},
    Config, Engine, Store, WasmBacktraceDetails,
};
use wasmtime_wasi::preview2::{WasiCtxBuilder, Table, WasiCtx, WasiView, wasi};

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

    wasi::command::add_to_linker(&mut linker)?;
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
