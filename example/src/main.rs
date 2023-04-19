use core::{future::Future, marker::Send, pin::Pin};
use std::time::Instant;

use anyhow::Result;
use host::{wasi::command::add_to_linker, WasiCtx};
use wasi_cap_std_sync::WasiCtxBuilder;
use wasmtime::{
    component::{Component, Linker},
    Config, Engine, Store, WasmBacktraceDetails,
};

wasmtime::component::bindgen!({
    world: "hello",
    path: "hello.wit",
    async: true
});

struct HelloState {}
impl external::Host for HelloState {
    fn get_answer<'life0, 'async_trait>(
        &'life0 mut self,
    ) -> Pin<Box<dyn Future<Output = wasmtime::Result<u32>> + Send + 'async_trait>>
    where
        'life0: 'async_trait,
        Self: 'async_trait,
    {
        Box::pin(async move { Ok(42) })
    }
}

struct State {
    wasi: WasiCtx,
    hello: HelloState,
}
impl State {
    pub fn new() -> Self {
        Self {
            wasi: WasiCtxBuilder::new()
                .inherit_stdin()
                .inherit_stdout()
                .build(),
            hello: HelloState {},
        }
    }
}

#[async_std::main]
async fn main() -> Result<()> {
    let mut config = Config::new();
    config.cache_config_load_default().unwrap();
    config.wasm_backtrace_details(WasmBacktraceDetails::Enable);
    config.wasm_component_model(true);
    config.async_support(true);

    let engine = Engine::new(&config).unwrap();
    let mut linker = Linker::new(&engine);
    add_to_linker(&mut linker, |x: &mut State| &mut x.wasi).unwrap();
    external::add_to_linker(&mut linker, |x: &mut State| &mut x.hello).unwrap();

    let mut store = Store::new(&engine, State::new());
    let component = Component::from_file(&engine, "hello.component.wasm").unwrap();

    // after getting the component, we can instantiate a markdown instance.
    let (instance, _instance) = Hello::instantiate_async(&mut store, &component, &linker).await?;
    let res = instance.call_hello(&mut store, "ComponentizeJS").await?;
    println!("{}", res);
    Ok(())
}
