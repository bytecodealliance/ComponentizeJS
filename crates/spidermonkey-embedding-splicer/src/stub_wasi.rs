use anyhow::{bail, Result};
use orca::ir::function::FunctionBuilder;
use orca::ir::id::{FunctionID, LocalID};
use orca::ir::module::module_functions::FuncKind;
use orca::ir::types::{BlockType, Value};
use orca::module_builder::AddLocal;
use orca::{DataType, InitExpr, Module, Opcode};
use std::{
    collections::HashSet,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
use wasmparser::{MemArg, TypeRef};

use wit_parser::Resolve;

use crate::{parse_wit, Features};

fn stub_import<StubFn>(
    module: &mut Module,
    import: &str,
    name: &str,
    stub: StubFn,
) -> Result<Option<FunctionID>>
where
    StubFn: Fn(&mut FunctionBuilder) -> Result<Vec<LocalID>>,
{
    let Some(iid) = module.imports.find(import.parse()?, name.parse()?) else {
        return Ok(None);
    };

    let TypeRef::Func(_) = module.imports.get(iid).ty else {
        bail!("'{import}#{name}' is not a function.")
    };
    let fid: FunctionID = iid as FunctionID;

    let f = module.functions.get(fid);
    let ty_id = match f.kind() {
        FuncKind::Local(_) => bail!("Can't find type of '{import}#{name}'"),
        FuncKind::Import(i) => i.ty_id,
    };

    let ty = module.types.get(ty_id).unwrap();
    let (params, results) = (ty.params.to_vec(), ty.results.to_vec());
    let mut builder = FunctionBuilder::new(params.as_slice(), results.as_slice());
    let args = stub(&mut builder)?;

    // let ty_id = module.types.add(&*params, &*results); Do not need to add a new type as replacing a function with the same type
    // Pass in Import ID as function ID to preserve location
    let local_func = builder.local_func(args, iid as FunctionID, ty_id);

    module.convert_import_fn_to_local(iid, local_func);

    Ok(Some(fid))
}

fn unreachable_stub(body: &mut FunctionBuilder) -> Result<Vec<LocalID>> {
    body.unreachable();
    body.end();
    Ok(vec![])
}

pub fn stub_wasi(
    wasm: Vec<u8>,
    features: Vec<Features>,
    wit_source: Option<String>,
    wit_path: Option<String>,
    world_name: Option<String>,
) -> Result<Vec<u8>> {
    let (resolve, ids) = if let Some(wit_source) = wit_source {
        let mut resolve = Resolve::default();
        let path = PathBuf::from("component.wit");
        let ids = resolve.push_str(&path, &wit_source)?;

        (resolve, ids)
    } else {
        parse_wit(&PathBuf::from(wit_path.unwrap()))?
    };

    let world = resolve.select_world(ids, world_name.as_deref())?;

    let target_world = &resolve.worlds[world];
    let mut target_world_imports = HashSet::new();

    for (key, _) in &target_world.imports {
        target_world_imports.insert(resolve.name_world_key(key));
    }

    let mut module = Module::parse(wasm.as_slice(), false).unwrap();

    stub_preview1(&mut module)?;

    stub_filesystem(&mut module, &target_world_imports)?;
    stub_cli(&mut module, &target_world_imports)?;

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
        || features.contains(&Features::Http)
        || target_world_requires_io(&target_world_imports);
    if !has_io {
        stub_io(&mut module)?;
    }

    stub_sockets(&mut module, &target_world_imports)?;
    Ok(module.encode())
}

fn target_world_requires_io(target_world_imports: &HashSet<String>) -> bool {
    target_world_imports.contains("wasi:sockets/instance-network@0.2.0")
        || target_world_imports.contains("wasi:sockets/udp@0.2.0")
        || target_world_imports.contains("wasi:sockets/udp-create-socket@0.2.0")
        || target_world_imports.contains("wasi:sockets/tcp@0.2.0")
        || target_world_imports.contains("wasi:sockets/tcp-create-socket@0.2.0")
        || target_world_imports.contains("wasi:sockets/ip-name-lookup@0.2.0")
        || target_world_imports.contains("wasi:sockets/network@0.2.0")
        || target_world_imports.contains("wasi:filesystem/types@0.2.0")
        || target_world_imports.contains("wasi:filesystem/preopens@0.2.0")
        || target_world_imports.contains("wasi:cli/terminal-stdin@0.2.0")
        || target_world_imports.contains("wasi:cli/terminal-stdout@0.2.0")
        || target_world_imports.contains("wasi:cli/terminal-stderr@0.2.0")
        || target_world_imports.contains("wasi:cli/terminal-input@0.2.0")
        || target_world_imports.contains("wasi:cli/terminal-output@0.2.0")
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
    let memory = module.get_memory_id().unwrap();
    let realloc = module
        .exports
        .get_func_by_name("cabi_realloc".to_string())
        .unwrap();
    // stubbed random implements random with a pseudorandom implementation
    // create a mutable random seed global
    let seed_val: i64 = 0;
    let seed_global = module.globals.create(
        InitExpr::Value(Value::I64(seed_val)),
        DataType::I64,
        true,
        false,
    );

    let random_u64 = stub_import(
        module,
        "wasi:random/random@0.2.0",
        "get-random-u64",
        |func| {
            func.global_get(seed_global);
            func.i64_const(-0x5F89E29B87429BD1);
            func.i64_add();
            func.global_set(seed_global);
            func.global_get(seed_global);
            func.global_get(seed_global);
            func.i64_const(-0x18FC812E5F4BD725);
            func.i64_xor();
            func.i64_mul();
            func.end();
            Ok(vec![])
        },
    )?
    .expect("get-random-u64 not found");

    stub_import(
        module,
        "wasi:random/random@0.2.0",
        "get-random-bytes",
        |body| {
            // let num_bytes = body.add_local(DataType::I64);
            let num_bytes = 0; // First parameter
            let retptr = 1; // Second parametr
            let outptr = body.add_local(DataType::I32);
            let curptr = body.add_local(DataType::I32);
            // carries through to *retptr = outptr
            body.local_get(retptr);

            // outptr = realloc(0, 0, 1, len rounded up to 8 bytes)
            body.i32_const(0);
            body.i32_const(0);
            body.i32_const(1);
            body.local_get(num_bytes);
            body.i32_wrap_i64();
            body.i32_const(3);
            body.i32_shr_unsigned();
            body.i32_const(3);
            body.i32_shl();
            body.i32_const(8);
            body.i32_add();
            body.call(realloc);

            body.local_tee(outptr);

            // *retptr = outptr
            // *retptr + 1 = len
            body.i32_store(MemArg {
                align: 2,
                max_align: 0,
                offset: 0,
                memory,
            });

            body.local_get(retptr);
            body.local_get(num_bytes);
            body.i32_wrap_i64();
            body.i32_store(MemArg {
                align: 2,
                max_align: 0,
                offset: 4,
                memory,
            });
            body.local_get(outptr);
            body.local_set(curptr);

            // store random bytes, we allocated a multiple of 8 bytes at the
            // start, so we do that exact multiple, while returning a shorter
            // list
            body.loop_stmt(BlockType::Empty);
            body.local_get(curptr);
            body.call(random_u64);
            body.i64_store(MemArg {
                align: 3,
                max_align: 0,
                offset: 0,
                memory,
            });
            body.local_get(curptr);
            body.i32_const(8);
            body.i32_add();
            body.local_tee(curptr);
            body.local_get(outptr);
            body.i32_sub();
            body.local_get(num_bytes);
            body.i32_wrap_i64();
            body.i32_lt_unsigned();
            body.br_if(0);
            body.end(); // This is for the loop
            body.end(); // This is for the function

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
    let memory = module.get_memory_id().unwrap();
    stub_import(module, PREVIEW1, "clock_res_get", unreachable_stub)?;

    // stub the time with the current time at build time
    let time = SystemTime::now();
    let unix_time = time.duration_since(UNIX_EPOCH)?;

    // (func (param i32 i64 i32) (result i32)))
    stub_import(module, PREVIEW1, "clock_time_get", |body| {
        let clock_id = 0; // First Parameter
        let precision = 1; // Second Parameter
        let time_ptr = 2; // Third Parameter
        body.local_get(time_ptr);
        body.local_get(time_ptr);
        body.i64_const(i64::try_from(unix_time.as_nanos())?);
        body.i64_store(MemArg {
            align: 3,
            offset: 0,
            max_align: 0,
            memory,
        });
        body.end();
        Ok(vec![clock_id, precision, time_ptr])
    })?;

    stub_import(module, "wasi:clocks/monotonic-clock@0.2.0", "now", |body| {
        body.i64_const(i64::try_from(unix_time.as_nanos())?);
        body.end();
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
        body.end();
        Ok(vec![])
    })?;

    // (func (param i32 i32 i32 i32) (result i32)))
    stub_import(module, PREVIEW1, "fd_write", |body| {
        let len_local = 3; // Index of the last local
        body.local_get(len_local);
        body.end();
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

fn stub_sockets(module: &mut Module, world_imports: &HashSet<String>) -> Result<()> {
    if !world_imports.contains("wasi:sockets/instance-network@0.2.0") {
        stub_import(
            module,
            "wasi:sockets/instance-network@0.2.0",
            "instance-network",
            unreachable_stub,
        )?;
    }

    if !world_imports.contains("wasi:sockets/udp@0.2.0") {
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
    }

    if !world_imports.contains("wasi:sockets/udp-create-socket@0.2.0") {
        stub_import(
            module,
            "wasi:sockets/udp-create-socket@0.2.0",
            "create-udp-socket",
            unreachable_stub,
        )?;
    }

    if !world_imports.contains("wasi:sockets/tcp@0.2.0") {
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
            "wasi:sockets/tcp@0.2.0",
            "[resource-drop]tcp-socket",
            unreachable_stub,
        )?;
    }

    if !world_imports.contains("wasi:sockets/tcp-create-socket@0.2.0") {
        stub_import(
            module,
            "wasi:sockets/tcp-create-socket@0.2.0",
            "create-tcp-socket",
            unreachable_stub,
        )?;
    }

    if !world_imports.contains("wasi:sockets/ip-name-lookup@0.2.0") {
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
            "wasi:sockets/ip-name-lookup@0.2.0",
            "[resource-drop]resolve-address-stream",
            unreachable_stub,
        )?;
    }

    if !world_imports.contains("wasi:sockets/network@0.2.0") {
        stub_import(
            module,
            "wasi:sockets/network@0.2.0",
            "[resource-drop]network",
            unreachable_stub,
        )?;
    }

    Ok(())
}

fn stub_filesystem(module: &mut Module, world_imports: &HashSet<String>) -> Result<()> {
    if !world_imports.contains("wasi:filesystem/types@0.2.0") {
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
            "wasi:filesystem/types@0.2.0",
            "[resource-drop]directory-entry-stream",
            unreachable_stub,
        )?;
    }

    if !world_imports.contains("wasi:filesystem/preopens@0.2.0") {
        stub_import(
            module,
            "wasi:filesystem/preopens@0.2.0",
            "get-directories",
            unreachable_stub,
        )?;
    }

    Ok(())
}

fn stub_cli(module: &mut Module, world_imports: &HashSet<String>) -> Result<()> {
    if !world_imports.contains("wasi:cli/environment@0.2.0") {
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
    }

    if !world_imports.contains("wasi:cli/exit@0.2.0") {
        stub_import(module, "wasi:cli/exit@0.2.0", "exit", unreachable_stub)?;
    }

    if !world_imports.contains("wasi:cli/terminal-stdin@0.2.0") {
        stub_import(
            module,
            "wasi:cli/terminal-stdin@0.2.0",
            "get-terminal-stdin",
            unreachable_stub,
        )?;
    }

    if !world_imports.contains("wasi:cli/terminal-stdout@0.2.0") {
        stub_import(
            module,
            "wasi:cli/terminal-stdout@0.2.0",
            "get-terminal-stdout",
            unreachable_stub,
        )?;
    }

    if !world_imports.contains("wasi:cli/terminal-stderr@0.2.0") {
        stub_import(
            module,
            "wasi:cli/terminal-stderr@0.2.0",
            "get-terminal-stderr",
            unreachable_stub,
        )?;
    }

    if !world_imports.contains("wasi:cli/terminal-input@0.2.0") {
        stub_import(
            module,
            "wasi:cli/terminal-input@0.2.0",
            "[resource-drop]terminal-input",
            unreachable_stub,
        )?;
    }

    if !world_imports.contains("wasi:cli/terminal-output@0.2.0") {
        stub_import(
            module,
            "wasi:cli/terminal-output@0.2.0",
            "[resource-drop]terminal-output",
            unreachable_stub,
        )?;
    }

    Ok(())
}
