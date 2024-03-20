use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{bail, Result};

use walrus::{
    ir::{MemArg, StoreKind},
    Function, FunctionBuilder, FunctionKind, ImportKind, ImportedFunction, InstrSeqBuilder,
    LocalId, Module, ValType,
};

use crate::Features;

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

const PREVIEW1: &str = "wasi_snapshot_preview1";

pub fn stub_wasi(wasm: Vec<u8>, features: Vec<Features>) -> Result<Vec<u8>> {
    let mut module = Module::from_buffer(wasm.as_slice())?;

    stub_import(&mut module, PREVIEW1, "environ_get", unreachable_stub)?;
    stub_import(&mut module, PREVIEW1, "environ_sizes_get", unreachable_stub)?;
    stub_import(&mut module, PREVIEW1, "fd_close", unreachable_stub)?;
    stub_import(
        &mut module,
        PREVIEW1,
        "fd_fdstat_set_flags",
        unreachable_stub,
    )?;
    stub_import(&mut module, PREVIEW1, "fd_prestat_get", unreachable_stub)?;
    stub_import(
        &mut module,
        PREVIEW1,
        "fd_prestat_dir_name",
        unreachable_stub,
    )?;
    stub_import(&mut module, PREVIEW1, "fd_read", unreachable_stub)?;
    stub_import(&mut module, PREVIEW1, "fd_seek", unreachable_stub)?;
    stub_import(&mut module, PREVIEW1, "path_open", unreachable_stub)?;
    stub_import(
        &mut module,
        PREVIEW1,
        "path_remove_directory",
        unreachable_stub,
    )?;
    stub_import(&mut module, PREVIEW1, "path_unlink_file", unreachable_stub)?;
    stub_import(&mut module, PREVIEW1, "proc_exit", unreachable_stub)?;
    // random comes from prevew2 only in StarlingMonkey
    stub_import(&mut module, PREVIEW1, "random_get", unreachable_stub)?;

    if !features.contains(&Features::Clocks) {
        stub_import(&mut module, PREVIEW1, "clock_res_get", unreachable_stub)?;

        let memory = module.get_memory_id().unwrap();

        // stub the time with the current time at build time
        let time = SystemTime::now();
        let unix_time = time.duration_since(UNIX_EPOCH).unwrap();

        // (func (param i32 i64 i32) (result i32)))
        let clock_id = module.locals.add(ValType::I32);
        let precision = module.locals.add(ValType::I64);
        let time_ptr = module.locals.add(ValType::I32);
        stub_import(&mut module, PREVIEW1, "clock_time_get", |body| {
            body.local_get(time_ptr);
            body.local_get(time_ptr);
            body.i64_const(i64::try_from(unix_time.as_nanos()).unwrap());
            body.store(
                memory,
                StoreKind::I64 { atomic: false },
                MemArg {
                    align: 4,
                    offset: 0,
                },
            );
            Ok(vec![clock_id, precision, time_ptr])
        })?;
    }

    if !features.contains(&Features::Stdio) {
        // (func (param i32 i32) (result i32)))
        stub_import(&mut module, PREVIEW1, "fd_fdstat_get", |body| {
            body.i32_const(0);
            Ok(vec![])
        })?;

        // (func (param i32 i32 i32 i32) (result i32)))
        let len_local = module.locals.add(ValType::I32);
        stub_import(&mut module, PREVIEW1, "fd_write", |body| {
            body.local_get(len_local);
            Ok(vec![len_local])
        })?;
    }

    Ok(module.emit_wasm())
}
