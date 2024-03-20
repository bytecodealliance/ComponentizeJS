use anyhow::{bail, Result};
use std::time::{SystemTime, UNIX_EPOCH};
use walrus::{
    ir::{BinaryOp, MemArg, StoreKind, UnaryOp},
    Function, FunctionBuilder, FunctionId, FunctionKind, ImportKind, ImportedFunction, InitExpr,
    InstrSeqBuilder, LocalId, Module, ValType,
};

use crate::Features;

fn stub_import<StubFn>(
    module: &mut Module,
    import: &str,
    name: &str,
    stub: StubFn,
) -> Result<Option<FunctionId>>
where
    StubFn: Fn(&mut InstrSeqBuilder) -> Result<Vec<LocalId>>,
{
    let Some(iid) = module.imports.find(import, name) else {
        return Ok(None);
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
    Ok(Some(fid))
}

fn unreachable_stub(body: &mut InstrSeqBuilder) -> Result<Vec<LocalId>> {
    body.unreachable();
    Ok(vec![])
}

pub fn stub_wasi(wasm: Vec<u8>, features: Vec<Features>) -> Result<Vec<u8>> {
    let mut module = Module::from_buffer(wasm.as_slice())?;

    stub_preview1(&mut module)?;
    stub_filesystem(&mut module)?;
    stub_cli(&mut module)?;

    if !features.contains(&Features::Random) {
        stub_random(&mut module)?;
    }

    if !features.contains(&Features::Clocks) {
        stub_clocks(&mut module)?;
    }

    if !features.contains(&Features::Stdio) {
        stub_stdio(&mut module)?;
    }

    if !features.contains(&Features::Http) {
        stub_http(&mut module)?;
    }

    let has_io = features.contains(&Features::Clocks)
        || features.contains(&Features::Stdio)
        || features.contains(&Features::Http);
    if !has_io {
        stub_io(&mut module)?;
    }

    stub_sockets(&mut module)?;

    Ok(module.emit_wasm())
}

const PREVIEW1: &str = "wasi_snapshot_preview1";
fn stub_preview1(module: &mut Module) -> Result<()> {
    stub_import(module, PREVIEW1, "environ_get", unreachable_stub)?;
    stub_import(module, PREVIEW1, "environ_sizes_get", unreachable_stub)?;
    stub_import(module, PREVIEW1, "fd_close", unreachable_stub)?;
    stub_import(module, PREVIEW1, "fd_fdstat_set_flags", unreachable_stub)?;
    stub_import(module, PREVIEW1, "fd_prestat_get", unreachable_stub)?;
    stub_import(module, PREVIEW1, "fd_readdir", unreachable_stub)?;
    stub_import(module, PREVIEW1, "args_get", unreachable_stub)?;
    stub_import(module, PREVIEW1, "args_sizes_get", unreachable_stub)?;
    stub_import(module, PREVIEW1, "path_filestat_get", unreachable_stub)?;
    stub_import(module, PREVIEW1, "fd_prestat_dir_name", unreachable_stub)?;
    stub_import(module, PREVIEW1, "fd_read", unreachable_stub)?;
    stub_import(module, PREVIEW1, "fd_seek", unreachable_stub)?;
    stub_import(module, PREVIEW1, "path_open", unreachable_stub)?;
    stub_import(module, PREVIEW1, "path_remove_directory", unreachable_stub)?;
    stub_import(module, PREVIEW1, "path_unlink_file", unreachable_stub)?;
    stub_import(module, PREVIEW1, "proc_exit", unreachable_stub)?;
    // random comes from prevew2 only in StarlingMonkey
    stub_import(module, PREVIEW1, "random_get", unreachable_stub)?;
    Ok(())
}

fn stub_random(module: &mut Module) -> Result<()> {
    let memory = module.get_memory_id()?;
    let realloc = module.exports.get_func("cabi_realloc")?;
    // stubbed random implements random with a pseudorandom implementation
    // create a mutable random seed global
    let seed_val: i64 = 0;
    let seed_global = module.globals.add_local(
        ValType::I64,
        true,
        InitExpr::Value(walrus::ir::Value::I64(seed_val)),
    );

    let random_u64 = stub_import(
        module,
        "wasi:random/random@0.2.0",
        "get-random-u64",
        |body| {
            body.global_get(seed_global);
            body.i64_const(-0x5F89E29B87429BD1);
            body.binop(BinaryOp::I64Add);
            body.global_set(seed_global);
            body.global_get(seed_global);
            body.global_get(seed_global);
            body.i64_const(-0x18FC812E5F4BD725);
            body.binop(BinaryOp::I64Xor);
            body.binop(BinaryOp::I64Mul);
            Ok(vec![])
        },
    )?
    .expect("get-random-u64 not found");

    let num_bytes = module.locals.add(ValType::I64);
    let retptr = module.locals.add(ValType::I32);
    let outptr = module.locals.add(ValType::I32);
    let curptr = module.locals.add(ValType::I32);
    stub_import(
        module,
        "wasi:random/random@0.2.0",
        "get-random-bytes",
        |body| {
            // carries through to *retptr = outptr
            body.local_get(retptr);

            // outptr = realloc(0, 0, 1, len rounded up to 8 bytes)
            body.i32_const(0);
            body.i32_const(0);
            body.i32_const(1);
            body.local_get(num_bytes);
            body.unop(UnaryOp::I32WrapI64);
            body.i32_const(3);
            body.binop(BinaryOp::I32ShrU);
            body.i32_const(3);
            body.binop(BinaryOp::I32Shl);
            body.i32_const(8);
            body.binop(BinaryOp::I32Add);
            body.call(realloc);

            body.local_tee(outptr);

            // *retptr = outptr
            // *retptr + 1 = len
            body.store(
                memory,
                StoreKind::I32 { atomic: false },
                MemArg {
                    align: 4,
                    offset: 0,
                },
            );

            body.local_get(retptr);
            body.local_get(num_bytes);
            body.unop(UnaryOp::I32WrapI64);
            body.store(
                memory,
                StoreKind::I32 { atomic: false },
                MemArg {
                    align: 4,
                    offset: 4,
                },
            );

            body.local_get(outptr);
            body.local_set(curptr);

            // store random bytes, we allocated a multiple of 8 bytes at the
            // start, so we do that exact multiple, while returning a shorter
            // list
            body.loop_(None, |body| {
                body.local_get(curptr);
                body.call(random_u64);
                body.store(
                    memory,
                    StoreKind::I64 { atomic: false },
                    MemArg {
                        align: 8,
                        offset: 0,
                    },
                );
                body.local_get(curptr);
                body.i32_const(8);
                body.binop(BinaryOp::I32Add);
                body.local_tee(curptr);

                body.local_get(outptr);
                body.binop(BinaryOp::I32Sub);
                body.local_get(num_bytes);
                body.unop(UnaryOp::I32WrapI64);
                body.binop(BinaryOp::I32LtU);
                body.br_if(body.id());
            });

            Ok(vec![num_bytes, retptr])
        },
    )?;

    stub_import(
        module,
        "wasi:random/insecure@0.2.0",
        "get-insecure-random-bytes",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:random/insecure@0.2.0",
        "get-insecure-random-u64",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:random/insecure-seed@0.2.0",
        "insecure-seed",
        unreachable_stub,
    )?;
    Ok(())
}

fn stub_clocks(module: &mut Module) -> Result<()> {
    let memory = module.get_memory_id()?;
    stub_import(module, PREVIEW1, "clock_res_get", unreachable_stub)?;

    // stub the time with the current time at build time
    let time = SystemTime::now();
    let unix_time = time.duration_since(UNIX_EPOCH)?;

    // (func (param i32 i64 i32) (result i32)))
    let clock_id = module.locals.add(ValType::I32);
    let precision = module.locals.add(ValType::I64);
    let time_ptr = module.locals.add(ValType::I32);
    stub_import(module, PREVIEW1, "clock_time_get", |body| {
        body.local_get(time_ptr);
        body.local_get(time_ptr);
        body.i64_const(i64::try_from(unix_time.as_nanos())?);
        body.store(
            memory,
            StoreKind::I64 { atomic: false },
            MemArg {
                align: 8,
                offset: 0,
            },
        );
        Ok(vec![clock_id, precision, time_ptr])
    })?;

    stub_import(module, "wasi:clocks/monotonic-clock@0.2.0", "now", |body| {
        body.i64_const(i64::try_from(unix_time.as_nanos())?);
        Ok(vec![])
    })?;
    stub_import(
        module,
        "wasi:clocks/monotonic-clock@0.2.0",
        "subscribe-instant",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:clocks/monotonic-clock@0.2.0",
        "resolution",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:clocks/monotonic-clock@0.2.0",
        "subscribe-duration",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:clocks/wall-clock@0.2.0",
        "now",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:clocks/wall-clock@0.2.0",
        "resolution",
        unreachable_stub,
    )?;

    Ok(())
}

fn stub_stdio(module: &mut Module) -> Result<()> {
    // (func (param i32 i32) (result i32)))
    stub_import(module, PREVIEW1, "fd_fdstat_get", |body| {
        body.i32_const(0);
        Ok(vec![])
    })?;

    // (func (param i32 i32 i32 i32) (result i32)))
    let len_local = module.locals.add(ValType::I32);
    stub_import(module, PREVIEW1, "fd_write", |body| {
        body.local_get(len_local);
        Ok(vec![len_local])
    })?;

    stub_import(
        module,
        "wasi:cli/stdin@0.2.0",
        "get-stdin",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:cli/stdout@0.2.0",
        "get-stdout",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:cli/stderr@0.2.0",
        "get-stderr",
        unreachable_stub,
    )?;
    Ok(())
}

fn stub_http(module: &mut Module) -> Result<()> {
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "http-error-code",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[static]fields.from-list",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]fields.has",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]outgoing-request.method",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]outgoing-request.path-with-query",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]outgoing-request.scheme",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]outgoing-request.authority",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]outgoing-request.headers",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[constructor]request-options",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]request-options.connect-timeout",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]request-options.set-connect-timeout",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]request-options.first-byte-timeout",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]request-options.set-first-byte-timeout",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]request-options.between-bytes-timeout",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]request-options.set-between-bytes-timeout",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[static]incoming-body.finish",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]future-trailers.subscribe",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]future-trailers.get",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]outgoing-response.status-code",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[resource-drop]incoming-request",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[resource-drop]outgoing-request",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[resource-drop]request-options",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[resource-drop]response-outparam",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[resource-drop]incoming-response",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[resource-drop]incoming-body",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[resource-drop]future-trailers",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[resource-drop]outgoing-response",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[resource-drop]outgoing-body",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[resource-drop]future-incoming-response",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[resource-drop]fields",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[constructor]fields",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]fields.get",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]fields.set",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]fields.delete",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]fields.append",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]fields.entries",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]fields.clone",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]incoming-request.method",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]incoming-request.path-with-query",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]incoming-request.scheme",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]incoming-request.authority",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]incoming-request.headers",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]incoming-request.consume",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[constructor]outgoing-request",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]outgoing-request.body",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]outgoing-request.set-method",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]outgoing-request.set-path-with-query",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]outgoing-request.set-scheme",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]outgoing-request.set-authority",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[static]response-outparam.set",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]incoming-response.status",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]incoming-response.headers",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]incoming-response.consume",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]incoming-body.stream",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[constructor]outgoing-response",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]outgoing-response.set-status-code",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]outgoing-response.headers",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]outgoing-response.body",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]outgoing-body.write",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[static]outgoing-body.finish",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]future-incoming-response.subscribe",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/types@0.2.0",
        "[method]future-incoming-response.get",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:http/outgoing-handler@0.2.0",
        "handle",
        unreachable_stub,
    )?;
    Ok(())
}

fn stub_io(module: &mut Module) -> Result<()> {
    stub_import(
        module,
        "wasi:io/poll@0.2.0",
        "[method]pollable.ready",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/poll@0.2.0",
        "[method]pollable.block",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/error@0.2.0",
        "[method]error.to-debug-string",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/streams@0.2.0",
        "[method]input-stream.blocking-read",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/streams@0.2.0",
        "[method]input-stream.skip",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/streams@0.2.0",
        "[method]input-stream.blocking-skip",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/streams@0.2.0",
        "[method]output-stream.blocking-write-and-flush",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/streams@0.2.0",
        "[method]output-stream.flush",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/streams@0.2.0",
        "[method]output-stream.write-zeroes",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/streams@0.2.0",
        "[method]output-stream.blocking-write-zeroes-and-flush",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/streams@0.2.0",
        "[method]output-stream.splice",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/streams@0.2.0",
        "[method]output-stream.blocking-splice",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/error@0.2.0",
        "[resource-drop]error",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/poll@0.2.0",
        "[resource-drop]pollable",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/streams@0.2.0",
        "[resource-drop]input-stream",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/streams@0.2.0",
        "[resource-drop]output-stream",
        unreachable_stub,
    )?;
    stub_import(module, "wasi:io/poll@0.2.0", "poll", unreachable_stub)?;
    stub_import(
        module,
        "wasi:io/streams@0.2.0",
        "[method]input-stream.read",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/streams@0.2.0",
        "[method]input-stream.subscribe",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/streams@0.2.0",
        "[method]output-stream.check-write",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/streams@0.2.0",
        "[method]output-stream.write",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/streams@0.2.0",
        "[method]output-stream.blocking-flush",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:io/streams@0.2.0",
        "[method]output-stream.subscribe",
        unreachable_stub,
    )?;
    Ok(())
}

fn stub_sockets(module: &mut Module) -> Result<()> {
    stub_import(
        module,
        "wasi:sockets/instance-network@0.2.0",
        "instance-network",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[method]udp-socket.start-bind",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[method]udp-socket.finish-bind",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[method]udp-socket.stream",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[method]udp-socket.local-address",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[method]udp-socket.remote-address",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[method]udp-socket.address-family",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[method]udp-socket.unicast-hop-limit",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[method]udp-socket.set-unicast-hop-limit",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[method]udp-socket.receive-buffer-size",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[method]udp-socket.set-receive-buffer-size",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[method]udp-socket.send-buffer-size",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[method]udp-socket.set-send-buffer-size",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[method]udp-socket.subscribe",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[method]incoming-datagram-stream.receive",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[method]incoming-datagram-stream.subscribe",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[method]outgoing-datagram-stream.check-send",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[method]outgoing-datagram-stream.send",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[method]outgoing-datagram-stream.subscribe",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp-create-socket@0.2.0",
        "create-udp-socket",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.start-bind",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.finish-bind",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.start-connect",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.finish-connect",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.start-listen",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.finish-listen",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.accept",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.local-address",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.remote-address",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.is-listening",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.address-family",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.set-listen-backlog-size",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.keep-alive-enabled",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.set-keep-alive-enabled",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.keep-alive-idle-time",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.set-keep-alive-idle-time",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.keep-alive-interval",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.set-keep-alive-interval",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.keep-alive-count",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.set-keep-alive-count",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.hop-limit",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.set-hop-limit",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.receive-buffer-size",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.set-receive-buffer-size",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.send-buffer-size",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.set-send-buffer-size",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.subscribe",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[method]tcp-socket.shutdown",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp-create-socket@0.2.0",
        "create-tcp-socket",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/ip-name-lookup@0.2.0",
        "resolve-addresses",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/ip-name-lookup@0.2.0",
        "[method]resolve-address-stream.resolve-next-address",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/ip-name-lookup@0.2.0",
        "[method]resolve-address-stream.subscribe",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/network@0.2.0",
        "[resource-drop]network",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[resource-drop]udp-socket",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[resource-drop]incoming-datagram-stream",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/udp@0.2.0",
        "[resource-drop]outgoing-datagram-stream",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/tcp@0.2.0",
        "[resource-drop]tcp-socket",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:sockets/ip-name-lookup@0.2.0",
        "[resource-drop]resolve-address-stream",
        unreachable_stub,
    )?;
    Ok(())
}

fn stub_filesystem(module: &mut Module) -> Result<()> {
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "filesystem-error-code",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.read-via-stream",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.write-via-stream",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.append-via-stream",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.advise",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.sync-data",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.get-flags",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.get-type",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.set-size",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.set-times",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.read",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.write",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.sync",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.create-directory-at",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.stat",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.stat-at",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.set-times-at",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.link-at",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.open-at",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.readlink-at",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.remove-directory-at",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.rename-at",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.symlink-at",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.unlink-file-at",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.is-same-object",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.metadata-hash",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.metadata-hash-at",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]directory-entry-stream.read-directory-entry",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[method]descriptor.read-directory",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[resource-drop]descriptor",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/preopens@0.2.0",
        "get-directories",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:filesystem/types@0.2.0",
        "[resource-drop]directory-entry-stream",
        unreachable_stub,
    )?;
    Ok(())
}

fn stub_cli(module: &mut Module) -> Result<()> {
    stub_import(
        module,
        "wasi:cli/environment@0.2.0",
        "get-environment",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:cli/environment@0.2.0",
        "get-arguments",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:cli/environment@0.2.0",
        "initial-cwd",
        unreachable_stub,
    )?;
    stub_import(module, "wasi:cli/exit@0.2.0", "exit", unreachable_stub)?;
    stub_import(
        module,
        "wasi:cli/terminal-stdin@0.2.0",
        "get-terminal-stdin",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:cli/terminal-stdout@0.2.0",
        "get-terminal-stdout",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:cli/terminal-stderr@0.2.0",
        "get-terminal-stderr",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:cli/terminal-input@0.2.0",
        "[resource-drop]terminal-input",
        unreachable_stub,
    )?;
    stub_import(
        module,
        "wasi:cli/terminal-output@0.2.0",
        "[resource-drop]terminal-output",
        unreachable_stub,
    )?;
    Ok(())
}
