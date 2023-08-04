use anyhow::{bail, Result};

use walrus::{
    Function, FunctionBuilder, FunctionKind, ImportKind, ImportedFunction, InstrSeqBuilder,
    LocalId, Module, ValType,
};

fn stub_import<StubFn>(module: &mut Module, import: &str, name: &str, stub: StubFn) -> Result<()>
where
    StubFn: Fn(&mut InstrSeqBuilder) -> Result<Vec<LocalId>>,
{
    let Some(iid) = module.imports.find(import, name) else {
        bail!("Cannot find '{import}#{name}' to stub.");
    };

    let ImportKind::Function(fid) = module.imports.get(iid).kind else {
        bail!("'{import}#{name}' is not a function.")
    };

    let Function {
        kind: FunctionKind::Import(ImportedFunction { ty, .. }),
        ..
    } = module.funcs.get(fid)
    else {
        bail!("Can't find type of '{import}#{name}'")
    };

    let ty = module.types.get(*ty);
    let (params, results) = (ty.params().to_vec(), ty.results().to_vec());

    let mut builder =
        FunctionBuilder::new(&mut module.types, params.as_slice(), results.as_slice());
    let args = stub(&mut builder.func_body())?;
    let local_func = builder.local_func(args);

    module.funcs.get_mut(fid).kind = FunctionKind::Local(local_func);

    module.imports.delete(iid);
    Ok(())
}

fn unreachable_stub(body: &mut InstrSeqBuilder) -> Result<Vec<LocalId>> {
    body.unreachable();
    Ok(vec![])
}

const WASI: &str = "wasi_snapshot_preview1";

pub fn stub_wasi(wasm: Vec<u8>, stdout: bool) -> Result<Vec<u8>> {
    let mut module = Module::from_buffer(wasm.as_slice())?;

    stub_import(&mut module, WASI, "clock_res_get", unreachable_stub)?;
    stub_import(&mut module, WASI, "environ_get", unreachable_stub)?;
    stub_import(&mut module, WASI, "environ_sizes_get", unreachable_stub)?;
    stub_import(&mut module, WASI, "fd_close", unreachable_stub)?;
    stub_import(&mut module, WASI, "fd_fdstat_set_flags", unreachable_stub)?;
    stub_import(&mut module, WASI, "fd_prestat_get", unreachable_stub)?;
    stub_import(&mut module, WASI, "fd_prestat_dir_name", unreachable_stub)?;
    stub_import(&mut module, WASI, "fd_read", unreachable_stub)?;
    stub_import(&mut module, WASI, "fd_seek", unreachable_stub)?;
    stub_import(&mut module, WASI, "path_open", unreachable_stub)?;
    stub_import(&mut module, WASI, "path_remove_directory", unreachable_stub)?;
    stub_import(&mut module, WASI, "path_unlink_file", unreachable_stub)?;
    stub_import(&mut module, WASI, "proc_exit", unreachable_stub)?;
    stub_import(&mut module, WASI, "random_get", unreachable_stub)?;

    // (func (param i32 i32 i32 i32) (result i32)))
    stub_import(&mut module, WASI, "clock_time_get", |body| {
        body.i32_const(0);
        Ok(vec![])
    })?;

    // (func (param i32 i32) (result i32)))
    stub_import(&mut module, WASI, "fd_fdstat_get", |body| {
        body.i32_const(0);
        Ok(vec![])
    })?;

    // (func (param i32 i32 i32 i32) (result i32)))
    let len_local = module.locals.add(ValType::I32);
    if !stdout {
        stub_import(&mut module, WASI, "fd_write", |body| {
            body.local_get(len_local);
            Ok(vec![len_local])
        })?;
    }

    Ok(module.emit_wasm())
}
