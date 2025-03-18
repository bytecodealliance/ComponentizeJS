use crate::bindgen::BindingItem;
use crate::wit::{CoreFn, CoreTy, SpliceResult};
use crate::{bindgen, map_core_fn, parse_wit, splice};
use anyhow::Result;
use orca_wasm::ir::function::{FunctionBuilder, FunctionModifier};
use orca_wasm::ir::id::{ExportsID, FunctionID, LocalID};
use orca_wasm::ir::module::Module;
use orca_wasm::ir::types::{BlockType, ElementItems, InstrumentationMode};
use orca_wasm::module_builder::AddLocal;
use orca_wasm::opcode::{Inject, InjectAt};
use orca_wasm::{DataType, Opcode};
use std::path::PathBuf;
use wasm_encoder::{Encode, Section};
use wasmparser::ExternalKind;
use wasmparser::MemArg;
use wasmparser::Operator;
use wit_component::metadata::{decode, Bindgen};
use wit_component::StringEncoding;
use wit_parser::Resolve;

// Returns
// pub struct SpliceResult {
//     pub wasm: _rt::Vec::<u8>,
//     pub js_bindings: _rt::String,
//     pub exports: _rt::Vec::<(_rt::String, CoreFn,)>,
//     pub import_wrappers: _rt::Vec::<(_rt::String, _rt::String,)>,
//     pub imports: _rt::Vec::<(_rt::String, _rt::String, u32,)>,
// }
pub fn splice_bindings(
    engine: Vec<u8>,
    world_name: Option<String>,
    wit_path: Option<String>,
    wit_source: Option<String>,
    debug: bool,
) -> Result<SpliceResult, String> {
    let (mut resolve, id) = if let Some(wit_source) = wit_source {
        let mut resolve = Resolve::default();
        let path = PathBuf::from("component.wit");
        let id = resolve
            .push_str(&path, &wit_source)
            .map_err(|e| e.to_string())?;
        (resolve, id)
    } else {
        parse_wit(&PathBuf::from(wit_path.unwrap())).map_err(|e| format!("{:?}", e))?
    };

    let world = resolve
        .select_world(id, world_name.as_deref())
        .map_err(|e| e.to_string())?;

    let mut wasm_bytes =
        wit_component::dummy_module(&resolve, world, wit_parser::ManglingAndAbi::Standard32);

    // merge the engine world with the target world, retaining the engine producers
    let (engine_world, producers) = if let Ok((
        _,
        Bindgen {
            resolve: mut engine_resolve,
            world: engine_world,
            metadata: _,
            producers,
        },
    )) = decode(&engine)
    {
        // we disable the engine run and incoming handler as we recreate these exports
        // when needed, so remove these from the world before initiating the merge
        let maybe_run = engine_resolve.worlds[engine_world]
            .exports
            .iter()
            .find(|(key, _)| {
                engine_resolve
                    .name_world_key(key)
                    .starts_with("wasi:cli/run@0.2")
            })
            .map(|(key, _)| key.clone());
        if let Some(run) = maybe_run {
            engine_resolve.worlds[engine_world]
                .exports
                .shift_remove(&run)
                .unwrap();
        }
        let maybe_serve = engine_resolve.worlds[engine_world]
            .exports
            .iter()
            .find(|(key, _)| {
                engine_resolve
                    .name_world_key(key)
                    .starts_with("wasi:http/incoming-handler@0.2.")
            })
            .map(|(key, _)| key.clone());

        if let Some(serve) = maybe_serve {
            engine_resolve.worlds[engine_world]
                .exports
                .shift_remove(&serve)
                .unwrap();
        }
        let map = resolve
            .merge(engine_resolve)
            .expect("unable to merge with engine world");
        let engine_world = map.map_world(engine_world, None).unwrap();
        (engine_world, producers)
    } else {
        unreachable!();
    };

    let componentized =
        bindgen::componentize_bindgen(&resolve, world).map_err(|err| err.to_string())?;

    resolve
        .merge_worlds(engine_world, world)
        .expect("unable to merge with engine world");

    let encoded =
        wit_component::metadata::encode(&resolve, world, StringEncoding::UTF8, producers.as_ref())
            .map_err(|e| e.to_string())?;

    let section = wasm_encoder::CustomSection {
        name: "component-type".into(),
        data: encoded.into(),
    };

    wasm_bytes.push(section.id());
    section.encode(&mut wasm_bytes);

    let mut generated_bindings = componentized.js_bindings;

    // let mut imports_mapped = Vec::new();
    // for impt in componentized.imports {

    // }

    // these should be temporary bindings fixups
    if generated_bindings.contains("utf8Encode") {
        generated_bindings = generated_bindings.replace(
            "function utf8Encode(s, realloc, memory) {
  if (typeof s !== 'string') throw new TypeError('expected a string');
  if (s.length === 0) {
    utf8EncodedLen = 0;
    return 1;
  }
  let allocLen = 0;
  let ptr = 0;
  let writtenTotal = 0;
  while (s.length > 0) {
    ptr = realloc(ptr, allocLen, 1, allocLen + s.length);
    allocLen += s.length;
    const { read, written } = utf8Encoder.encodeInto(
    s,
    new Uint8Array(memory.buffer, ptr + writtenTotal, allocLen - writtenTotal),
    );
    writtenTotal += written;
    s = s.slice(read);
  }
  if (allocLen > writtenTotal)
  ptr = realloc(ptr, allocLen, 1, writtenTotal);
  utf8EncodedLen = writtenTotal;
  return ptr;
}",
            "function utf8Encode(s, realloc, memory) {
  const buf = utf8Encoder.encode(s);
  const ptr = realloc(0, 0, 1, buf.byteLength);
  const out = new Uint8Array(memory.buffer, ptr, buf.byteLength);
  for (let i = 0; i < buf.byteLength; i++) {
    out[i] = buf[i];
  }
  utf8EncodedLen = buf.byteLength;
  return ptr;
}",
        );
    }

    let mut exports = Vec::new();
    for (
        export_name,
        BindingItem {
            name,
            func,
            iface,
            resource,
            ..
        },
    ) in &componentized.exports
    {
        let expt = if *iface {
            let name = resource.canon_string(&name);
            format!("{export_name}#{name}")
        } else {
            export_name.clone()
        };
        exports.push((expt, map_core_fn(func)));
    }

    let mut imports = Vec::new();
    for (
        specifier,
        BindingItem {
            name,
            func,
            iface,
            resource,
            ..
        },
    ) in &componentized.imports
    {
        if *iface {
            imports.push((
                specifier.to_string(),
                resource.canon_string(&name),
                map_core_fn(func),
                if func.retsize > 0 {
                    Some(func.retsize as i32)
                } else {
                    None
                },
            ));
        } else {
            imports.push((
                "$root".into(),
                specifier.to_string(),
                map_core_fn(func),
                if func.retsize > 0 {
                    Some(func.retsize as i32)
                } else {
                    None
                },
            ));
        }
    }

    for (key, name, return_count) in &componentized.resource_imports {
        imports.push((
            key.clone(),
            name.clone(),
            CoreFn {
                params: vec![CoreTy::I32],
                ret: if *return_count == 0 {
                    None
                } else {
                    Some(CoreTy::I32)
                },
                retptr: false,
                retsize: 0,
                paramptr: false,
            },
            Some(i32::try_from(*return_count).unwrap()),
        ));
    }

    let mut wasm =
        splice::splice(engine, imports, exports, debug).map_err(|e| format!("{:?}", e))?;

    // add the world section to the spliced wasm
    wasm.push(section.id());
    section.encode(&mut wasm);

    Ok(SpliceResult {
        wasm,
        exports: componentized
            .exports
            .iter()
            .map(
                |(
                    _,
                    BindingItem {
                        binding_name, func, ..
                    },
                )| { (binding_name.to_string(), map_core_fn(&func)) },
            )
            .collect(),
        imports: componentized
            .imports
            .iter()
            .map(
                |(
                    specifier,
                    BindingItem {
                        name,
                        iface,
                        func,
                        resource,
                        ..
                    },
                )| {
                    (
                        if *iface {
                            specifier.to_string()
                        } else {
                            "$root".into()
                        },
                        if *iface {
                            resource.canon_string(&name)
                        } else {
                            specifier.to_string()
                        },
                        func.params.len() as u32,
                    )
                },
            )
            .chain(componentized.resource_imports)
            .collect(),
        js_bindings: generated_bindings,
    })
}

//
// Parses the Spidermonkey binary into section data for reserialization
// into an output binary, and in the process:
//
// 1. Imported function bindings are generated. This is based on splicing
//    together the core binding steps that are deconstructed from the
//    "coreabi-sample" template, and that function is then removed entirely.
//    Import functions are then placed into the table for indirect call
//    referencing.
//
//    The following sample functions are used for imports:
//    - "coreabi_get_import"
//    - "coreabi_sample_i32"
//    - "coreabi_sample_i64"
//    - "coreabi_sample_f32"
//    - "coreabi_sample_f64"
//
// 2. Exported function bindings and their post-call functions are generated
//    for all provided exported functions ("[name]" and "cabi_post_[name]").
//    These are created simply by calling the "call" and "post_call" generic
//    core wasm functions which take a list of core type variants.
//
//
pub fn splice(
    engine: Vec<u8>,
    imports: Vec<(String, String, CoreFn, Option<i32>)>,
    exports: Vec<(String, CoreFn)>,
    debug: bool,
) -> Result<Vec<u8>> {
    let mut module = Module::parse(&*engine, false).unwrap();

    // since StarlingMonkey implements CLI Run and incoming handler,
    // we override them only if the guest content exports those functions
    remove_if_exported_by_js(&mut module, &exports, "wasi:cli/run@0.2.", "#run");
    remove_if_exported_by_js(
        &mut module,
        &exports,
        "wasi:http/incoming-handler@0.2.",
        "#handle",
    );

    // we reencode the WASI world component data, so strip it out from the
    // custom section
    let maybe_component_section_id = module
        .custom_sections
        .get_id("component-type:bindings".to_string());
    if let Some(component_section_id) = maybe_component_section_id {
        module.custom_sections.delete(component_section_id);
    }

    // extract the native instructions from sample functions
    // then inline the imported functions and main import gating function
    // (erasing sample functions in the process)
    synthesize_import_functions(&mut module, &imports, debug)?;

    // create the exported functions as wrappers around the "cabi_call" function
    synthesize_export_functions(&mut module, &exports)?;

    Ok(module.encode())
}

fn remove_if_exported_by_js(
    module: &mut Module,
    content_exports: &Vec<(String, CoreFn)>,
    name_start: &str,
    name_end: &str,
) {
    let content_exports_run = content_exports
        .iter()
        .any(|(name, _)| name.starts_with(name_start) && name.ends_with(name_end));
    if content_exports_run {
        let exported_run_fn = module
            .exports
            .iter()
            .find(|export| export.name.starts_with(name_start) && export.name.ends_with(name_end))
            .unwrap();
        let export_id = module
            .exports
            .get_export_id_by_name(String::from(&exported_run_fn.name))
            .unwrap();
        let function_id = module
            .exports
            .get_func_by_name(String::from(&exported_run_fn.name))
            .unwrap();
        module.exports.delete(export_id);
        module.delete_func(function_id);
    }
}

fn get_export_fid(module: &Module, expt_id: &ExportsID) -> FunctionID {
    let expt = module.exports.get_by_id(*expt_id).unwrap();

    match expt.kind {
        ExternalKind::Func => FunctionID::from(expt.index),
        _ => panic!("Missing coreabi_get_import"),
    }
}

fn synthesize_import_functions(
    module: &mut Module,
    imports: &Vec<(String, String, CoreFn, Option<i32>)>,
    debug: bool,
) -> Result<()> {
    let mut coreabi_get_import: Option<ExportsID> = None;
    let mut cabi_realloc: Option<ExportsID> = None;

    let mut coreabi_sample_ids = Vec::new();
    for (id, expt) in module.exports.iter().enumerate() {
        match expt.name.as_str() {
            "coreabi_sample_i32" | "coreabi_sample_i64" | "coreabi_sample_f32"
            | "coreabi_sample_f64" => coreabi_sample_ids.push(ExportsID::from(id)),
            "coreabi_get_import" => coreabi_get_import = Some(ExportsID::from(id)),
            "cabi_realloc" => cabi_realloc = Some(ExportsID::from(id)),
            _ => {}
        };
    }

    let memory = 0;

    let main_tid = module.tables.main_function().unwrap();

    let import_fn_table_start_idx = module.tables.get(main_tid).unwrap().initial as i32;

    let cabi_realloc_fid = get_export_fid(module, &cabi_realloc.unwrap());

    let fid = get_export_fid(module, &coreabi_sample_ids[0]);
    let coreabi_sample_i32 = module.functions.get(fid).unwrap_local();
    let _coreabi_sample_i64 = module
        .functions
        .get(get_export_fid(module, &coreabi_sample_ids[1]))
        .unwrap_local();
    let _coreabi_sample_f32 = module
        .functions
        .get(get_export_fid(module, &coreabi_sample_ids[2]))
        .unwrap_local();
    let _coreabi_sample_f64 = module
        .functions
        .get(get_export_fid(module, &coreabi_sample_ids[3]))
        .unwrap_local();

    // These functions retrieve the corresponding type
    // from a JS::HandleValue
    // All except for the BigInt one are trivial and thus
    // do not require regular explicit template extraction
    // unless there are major ABI changes in Spidermonkey
    let coreabi_from_bigint64 = module
        .exports
        .get_export_id_by_name("coreabi_from_bigint64".to_string())
        .unwrap();

    // Sets the return value on args from the stack
    let args_ret_i32: Vec<Operator> = vec![
        Operator::I64ExtendI32U,
        Operator::I64Const {
            value: -545460846592,
        },
        Operator::I64Or,
        Operator::I64Store {
            memarg: MemArg {
                align: 2,
                max_align: 0,
                offset: 0,
                memory,
            },
        },
    ];

    // BigInt instructions are a little more involved as we need to extract
    // the separate ToBigInt call from the get_i64 sample
    let coreabi_to_bigint64 = module
        .exports
        .get_export_id_by_name("coreabi_to_bigint64".to_string())
        .unwrap();

    // create the import functions
    // All JS wrapper function bindings have the same type, the
    // the Spidermonkey native function binding type:
    //
    //     bool NativeFn(JSContext *cx, unsigned argc, JS::Value *vp)
    //
    let mut import_fnids: Vec<FunctionID> = Vec::new();
    {
        // synthesized native import function parameters (in order)
        let ctx_arg = coreabi_sample_i32.args[0];
        // let argc_arg = coreabi_sample_i32.args[1]; // Unused
        let vp_arg = coreabi_sample_i32.args[2];

        // if we need to tee the retptr
        for (impt_specifier, impt_name, impt_sig, retptr_size) in imports.iter() {
            if debug {
                println!(
                    "> IMPORT {} {} > {:?}",
                    impt_specifier, impt_name, &impt_sig
                );
            }

            // add the imported function type
            let params: Vec<DataType> = impt_sig
                .params
                .iter()
                .map(|ty| match ty {
                    CoreTy::I32 => DataType::I32,
                    CoreTy::I64 => DataType::I64,
                    CoreTy::F32 => DataType::F32,
                    CoreTy::F64 => DataType::F64,
                })
                .collect();
            let ret = match impt_sig.ret {
                Some(ty) => vec![match ty {
                    CoreTy::I32 => DataType::I32,
                    CoreTy::I64 => DataType::I64,
                    CoreTy::F32 => DataType::F32,
                    CoreTy::F64 => DataType::F64,
                }],
                None => vec![],
            };
            let import_fn_type = module.types.add_func_type(&params, &ret);
            let import_fn_fid = if let Some(existing) = module
                .imports
                .get_func((*impt_specifier).clone(), (*impt_name).clone())
            {
                existing
            } else {
                module
                    .add_import_func(
                        (*impt_specifier).clone(),
                        (*impt_name).clone(),
                        import_fn_type,
                    )
                    .0
            };

            // create the native JS binding function
            let mut func = FunctionBuilder::new(
                &[DataType::I32, DataType::I32, DataType::I32],
                &[DataType::I32],
            );

            let retptr_local = func.add_local(DataType::I32);
            let tmp_local = func.add_local(DataType::I64);

            // stack the return arg now as it chains with the
            // args we're about to add to the stack
            if impt_sig.ret.is_some() {
                func.local_get(vp_arg);

                // if an i64 return, then we need to stack the extra BigInt constructor arg for that now
                if matches!(impt_sig.ret.unwrap(), CoreTy::I64) {
                    func.local_get(ctx_arg);
                }
            }

            for (idx, arg) in impt_sig.params.iter().enumerate() {
                // for retptr, we must explicitly created it rather than receiving it
                if impt_sig.retptr && idx == impt_sig.params.len() - 1 {
                    break;
                }
                // JS args
                func.local_get(vp_arg);
                // JS args offset
                func.i32_const(16 + 8 * idx as i32);
                func.i32_add();
                match arg {
                    CoreTy::I32 => {
                        func.i64_load(MemArg {
                            align: 3,
                            max_align: 0,
                            offset: 0,
                            memory,
                        });
                        func.i32_wrap_i64();
                    }
                    CoreTy::I64 => {
                        func.call(get_export_fid(&module, &coreabi_from_bigint64));
                    }
                    CoreTy::F32 => {
                        // isInt: (r.asRawBits() >> 32) == 0xFFFFFF81
                        func.i64_load(MemArg {
                            align: 3,
                            max_align: 0,
                            offset: 0,
                            memory,
                        });
                        func.local_tee(tmp_local);
                        func.i64_const(32);
                        func.i64_shr_unsigned();
                        func.i64_const(0xFFFFFF81);
                        func.i64_eq();
                        func.if_stmt(BlockType::Type(DataType::F32));
                        func.local_get(tmp_local);
                        func.i32_wrap_i64();
                        func.f32_convert_i32s();
                        func.else_stmt();
                        func.local_get(tmp_local);
                        func.f64_reinterpret_i64();
                        func.f32_demote_f64();
                        func.end(); // This is for the if - else block
                    }
                    CoreTy::F64 => {
                        // isInt: (r.asRawBits() >> 32) == 0xFFFFFF81
                        func.i64_load(MemArg {
                            align: 3,
                            max_align: 0,
                            offset: 0,
                            memory,
                        });
                        func.local_tee(tmp_local);
                        func.i64_const(32);
                        func.i64_shr_unsigned();
                        func.i64_const(0xFFFFFF81);
                        func.i64_eq();
                        func.if_stmt(BlockType::Type(DataType::F64));
                        func.local_get(tmp_local);
                        func.i32_wrap_i64();
                        func.f64_convert_i32s();
                        func.else_stmt();
                        func.local_get(tmp_local);
                        func.f64_reinterpret_i64();
                        func.end(); // This is for the if - else block
                    }
                };
            }

            // if a retptr,
            // allocate and put the retptr on the call stack as the last passed argument
            if impt_sig.retptr {
                assert!(!impt_sig.ret.is_some());
                // prepare the context arg for the return set shortly
                func.local_get(vp_arg);

                // allocate the retptr
                func.i32_const(0);
                func.i32_const(0);
                func.i32_const(4);
                // Last realloc arg is byte length to allocate
                func.i32_const(retptr_size.unwrap());

                // Call realloc, getting back the retptr
                func.call(cabi_realloc_fid);

                // tee the retptr into a local
                func.local_tee(retptr_local);

                // also set the retptr as the return value of the JS function
                // (consumes the context arg above)
                args_ret_i32.iter().for_each(|instr| {
                    func.inject(instr.clone());
                });

                // add the retptr back on the stack for the call
                func.local_get(retptr_local);
            }

            // main call to the import lowering function
            func.call(import_fn_fid);

            match impt_sig.ret {
                None => {}
                Some(CoreTy::I32) => args_ret_i32.iter().for_each(|instr| {
                    func.inject(instr.clone());
                }),
                Some(CoreTy::I64) => {
                    func.call(get_export_fid(&module, &coreabi_to_bigint64));
                    func.i64_extend_i32u();
                    func.i64_const(-511101108224);
                    func.i64_or();
                    func.i64_store(MemArg {
                        align: 3,
                        max_align: 0,
                        offset: 0,
                        memory,
                    });
                }
                Some(CoreTy::F32) => {
                    func.f64_promote_f32();
                    func.f64_store(MemArg {
                        align: 3,
                        max_align: 0,
                        offset: 0,
                        memory,
                    });
                }
                Some(CoreTy::F64) => {
                    func.f64_store(MemArg {
                        align: 3,
                        max_align: 0,
                        offset: 0,
                        memory,
                    });
                }
            }

            // return true
            func.i32_const(1);

            let fid = func.finish_module(module);
            import_fnids.push(fid);
        }

        // extend the main table to include indices for generated imported functions
        let table = module.tables.get_mut(main_tid);
        table.initial += imports.len() as u64;
        table.maximum = Some(table.maximum.unwrap() + imports.len() as u64);

        // create imported function table
        let els = module.elements.iter_mut().next().unwrap();
        match &mut els.1 {
            ElementItems::Functions(ref mut funcs) => {
                for fid in import_fnids {
                    funcs.push(fid);
                }
            }
            _ => {}
        }
    }

    // Populate the import creation function of the form:
    //
    // This function already exists, we just have to fixup the contents to the right <baseidx>
    //
    // JSFunction *coreabi_get_import(int32_t idx, int32_t argcnt, const char *name) {
    //   return JS_NewFunction(R.cx, <baseidx> + idx, argcnt, name);
    // }
    //
    {
        let coreabi_get_import_fid = get_export_fid(module, &coreabi_get_import.unwrap());

        let args = &module
            .functions
            .get(coreabi_get_import_fid)
            .kind()
            .unwrap_local()
            .args;

        let arg_idx = args[0];

        let builder: &mut FunctionModifier = &mut module
            .functions
            .get_fn_modifier(coreabi_get_import_fid)
            .unwrap();

        // walk until we get to the const representing the table index
        let mut table_instr_idx = 0;
        for (idx, instr) in builder.body.instructions.iter_mut().enumerate() {
            if let Operator::I32Const { value: ref mut v } = instr.op {
                // we specifically need the const "around" 3393
                // which is the coreabi_sample_i32 table offset
                if *v < 1000 || *v > 5000 {
                    continue;
                }
                *v = import_fn_table_start_idx;
                table_instr_idx = idx;
                break;
            }
        }
        builder.inject_at(
            table_instr_idx,
            InstrumentationMode::Before,
            Operator::LocalGet {
                local_index: *arg_idx,
            },
        );
        builder.inject_at(
            table_instr_idx + 1,
            InstrumentationMode::Before,
            Operator::I32Add,
        );
    }

    // remove unnecessary exports
    module.exports.delete(coreabi_to_bigint64);
    module.exports.delete(coreabi_from_bigint64);
    module.exports.delete(coreabi_get_import.unwrap());
    for id in coreabi_sample_ids {
        module.exports.delete(id);
    }

    Ok(())
}

fn synthesize_export_functions(module: &mut Module, exports: &Vec<(String, CoreFn)>) -> Result<()> {
    let cabi_realloc = get_export_fid(
        module,
        &module
            .exports
            .get_export_id_by_name("cabi_realloc".to_string())
            .unwrap(),
    );
    let call_expt = module
        .exports
        .get_export_id_by_name("call".to_string())
        .unwrap();
    let call = get_export_fid(module, &call_expt);
    let post_call_expt = module
        .exports
        .get_export_id_by_name("post_call".to_string())
        .unwrap();
    let post_call = get_export_fid(module, &post_call_expt);

    let memory = 0;
    // (2) Export call function synthesis
    for (export_num, (expt_name, expt_sig)) in exports.iter().enumerate() {
        // Export function synthesis
        {
            // add the function type
            let params: Vec<DataType> = expt_sig
                .params
                .iter()
                .map(|ty| match ty {
                    CoreTy::I32 => DataType::I32,
                    CoreTy::I64 => DataType::I64,
                    CoreTy::F32 => DataType::F32,
                    CoreTy::F64 => DataType::F64,
                })
                .collect();
            let ret = expt_sig
                .ret
                .iter()
                .map(|ty| match ty {
                    CoreTy::I32 => DataType::I32,
                    CoreTy::I64 => DataType::I64,
                    CoreTy::F32 => DataType::F32,
                    CoreTy::F64 => DataType::F64,
                })
                .collect::<Vec<DataType>>();

            let mut func = FunctionBuilder::new(&params, &ret);
            func.set_name(expt_name.to_string());

            let args: Vec<LocalID> = params
                .iter()
                .enumerate()
                .map(|(idx, _)| LocalID::from(idx))
                .collect(); // Collect the arguments of the function

            let arg_ptr = func.add_local(DataType::I32);
            let ret_ptr = func.add_local(DataType::I32);

            // Stack "call" arg1 - export number to call
            func.i32_const(export_num as i32);

            // Now we just have to add the argptr
            if expt_sig.params.is_empty() {
                func.i32_const(0);
            } else if expt_sig.paramptr {
                // param ptr is the first arg with indirect params
                func.local_get(args[0]);
            } else {
                // realloc call to allocate params
                func.i32_const(0);
                func.i32_const(0);
                func.i32_const(4);
                // Last realloc arg is byte length to allocate
                let mut byte_size = 0;
                for param in expt_sig.params.iter() {
                    match param {
                        CoreTy::I32 | CoreTy::F32 => {
                            byte_size += 4;
                        }
                        CoreTy::I64 | CoreTy::F64 => {
                            byte_size += 8;
                        }
                    }
                }
                func.i32_const(byte_size);
                // Call realloc, getting back the argptr
                func.call(cabi_realloc);

                // Tee the argptr into its local var
                func.local_tee(arg_ptr);

                let mut offset = 0;
                for (idx, param) in expt_sig.params.iter().enumerate() {
                    func.local_get(args[idx]);
                    match param {
                        CoreTy::I32 => {
                            func.i32_store(MemArg {
                                align: 2,
                                max_align: 0,
                                offset,
                                memory,
                            });
                            offset += 4;
                        }
                        CoreTy::I64 => {
                            func.i64_store(MemArg {
                                align: 3,
                                offset,
                                memory,
                                max_align: 0,
                            });
                            offset += 8;
                        }
                        CoreTy::F32 => {
                            func.f32_store(MemArg {
                                align: 2,
                                max_align: 0,
                                offset,
                                memory,
                            });
                            offset += 4;
                        }
                        CoreTy::F64 => {
                            func.f64_store(MemArg {
                                align: 3,
                                offset,
                                memory,
                                max_align: 0,
                            });
                            offset += 8;
                        }
                    }
                    func.local_get(arg_ptr);
                }

                // argptr stays on stack
            }

            // Call "call" (returns retptr)
            func.call(call);

            if expt_sig.ret.is_none() {
                func.drop();
            } else if !expt_sig.retptr {
                // Tee retptr into its local var
                func.local_tee(ret_ptr);

                // if it's a direct return, we must read the return
                // value type from the retptr
                match expt_sig.ret.unwrap() {
                    CoreTy::I32 => {
                        func.i32_load(MemArg {
                            align: 2,
                            max_align: 0,
                            offset: 0,
                            memory,
                        });
                    }
                    CoreTy::I64 => {
                        func.i64_load(MemArg {
                            align: 3,
                            max_align: 0,
                            offset: 0,
                            memory,
                        });
                    }
                    CoreTy::F32 => {
                        func.f32_load(MemArg {
                            align: 2,
                            max_align: 0,
                            offset: 0,
                            memory,
                        });
                    }
                    CoreTy::F64 => {
                        func.f64_load(MemArg {
                            align: 3,
                            offset: 0,
                            memory,
                            max_align: 0,
                        });
                    }
                }
            }

            let fid = func.finish_module(module);
            module.exports.add_export_func((*expt_name).clone(), *fid);
        }

        // Post export function synthesis
        // We always define a post-export since we use a bulk deallocation strategy
        // add the function type
        let params = if let Some(ret) = expt_sig.ret {
            vec![match ret {
                CoreTy::I32 => DataType::I32,
                CoreTy::I64 => DataType::I64,
                CoreTy::F32 => DataType::F32,
                CoreTy::F64 => DataType::F64,
            }]
        } else {
            vec![]
        };
        let mut func = FunctionBuilder::new(&params, &[]);
        func.set_name(format!("post_{}", expt_name));

        // calls post_call with just the function number argument
        // internally post_call is already tracking the frees needed
        // and that is currently done based on timing assumptions of calls
        func.i32_const(export_num as i32);
        func.call(post_call);
        let fid = func.finish_module(module);
        module
            .exports
            .add_export_func(format!("cabi_post_{}", expt_name), *fid);
    }

    // remove unnecessary exports
    module.exports.delete(call_expt);
    module.exports.delete(post_call_expt);

    Ok(())
}
