use std::path::PathBuf;
use std::time::Instant;

use anyhow::Result;
use wirm::ir::function::{FunctionBuilder, FunctionModifier};
use wirm::ir::id::{ExportsID, FunctionID, LocalID};
use wirm::ir::module::Module;
use wirm::ir::types::{BlockType, ElementItems, InstrumentationMode};
use wirm::module_builder::AddLocal;
use wirm::opcode::{Inject, InjectAt};
use wirm::{DataType, Opcode};
use wasm_encoder::{Encode, Section};
use wasmparser::ExternalKind;
use wasmparser::MemArg;
use wasmparser::Operator;
use wit_component::metadata::{decode, Bindgen};
use wit_component::StringEncoding;
use wit_parser::Resolve;

use crate::bindgen::BindingItem;
use crate::wit::exports::local::spidermonkey_embedding_splicer::splicer::{
    CoreFn, CoreTy, Feature, SpliceResult,
};
use crate::{bindgen, map_core_fn, parse_wit, splice};

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
    features: Vec<Feature>,
    wit_source: Option<String>,
    wit_path: Option<String>,
    world_name: Option<String>,
    debug: bool,
) -> Result<SpliceResult, String> {
    let t_total = Instant::now();
    let mut t_stage = Instant::now();
    let (mut resolve, id) = match (wit_source, wit_path) {
        (Some(wit_source), _) => {
            t_stage = Instant::now();
            let mut resolve = Resolve::default();
            let path = PathBuf::from("component.wit");
            let id = resolve
                .push_str(&path, &wit_source)
                .map_err(|e| e.to_string())?;
            eprintln!(
                "trace(splice:wit-parse): {} ms",
                t_stage.elapsed().as_millis()
            );
            (resolve, id)
        }
        (_, Some(wit_path)) => parse_wit(&wit_path).map_err(|e| format!("{e:?}"))?,
        (None, None) => {
            return Err("neither wit source nor path have been specified".into());
        }
    };

    t_stage = Instant::now();
    let world = resolve
        .select_world(id, world_name.as_deref())
        .map_err(|e| e.to_string())?;
    eprintln!(
        "trace(splice:wit-select-world): {} ms",
        t_stage.elapsed().as_millis()
    );

    t_stage = Instant::now();
    let mut wasm_bytes =
        wit_component::dummy_module(&resolve, world, wit_parser::ManglingAndAbi::Standard32);
    eprintln!(
        "trace(splice:dummy-module): {} ms",
        t_stage.elapsed().as_millis()
    );

    // merge the engine world with the target world, retaining the engine producers

    t_stage = Instant::now();
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
        eprintln!(
            "trace(splice:engine-decode): {} ms",
            t_stage.elapsed().as_millis()
        );
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
        t_stage = Instant::now();
        let map = resolve
            .merge(engine_resolve)
            .expect("unable to merge with engine world");
        let engine_world = map.map_world(engine_world, None).unwrap();
        eprintln!(
            "trace(splice:merge-engine-world): {} ms",
            t_stage.elapsed().as_millis()
        );
        (engine_world, producers)
    } else {
        unreachable!();
    };

    t_stage = Instant::now();
    let componentized =
        bindgen::componentize_bindgen(&resolve, world, &features).map_err(|err| err.to_string())?;
    eprintln!(
        "trace(splice:bindgen): {} ms",
        t_stage.elapsed().as_millis()
    );

    t_stage = Instant::now();
    resolve
        .merge_worlds(engine_world, world)
        .expect("unable to merge with engine world");
    eprintln!(
        "trace(splice:merge-worlds): {} ms",
        t_stage.elapsed().as_millis()
    );

    t_stage = Instant::now();
    let encoded =
        wit_component::metadata::encode(&resolve, world, StringEncoding::UTF8, producers.as_ref())
            .map_err(|e| e.to_string())?;
    eprintln!(
        "trace(splice:metadata-encode): {} ms",
        t_stage.elapsed().as_millis()
    );

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
            let name = resource.canon_string(name);
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
                resource.canon_string(name),
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

    t_stage = Instant::now();
    let mut wasm =
        splice::splice(engine, imports, exports, features, debug).map_err(|e| format!("{e:?}"))?;
    eprintln!(
        "trace(splice:wasm-splice): {} ms",
        t_stage.elapsed().as_millis()
    );

    // add the world section to the spliced wasm
    wasm.push(section.id());
    section.encode(&mut wasm);

    eprintln!(
        "trace(splice:total): {} ms",
        t_total.elapsed().as_millis()
    );
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
                )| { (binding_name.to_string(), map_core_fn(func)) },
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
                            resource.canon_string(name)
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
    features: Vec<Feature>,
    debug: bool,
) -> Result<Vec<u8>> {
    let t_total = Instant::now();
    let mut t_stage = Instant::now();

    // Pre-scan sections to understand where bytes are concentrated
    {
        let t_scan = Instant::now();
        let mut section_sizes: Vec<(String, usize)> = Vec::new();
        let mut custom_sections: usize = 0;
        let mut functions_declared: u32 = 0;
        let mut data_bytes: usize = 0;
        let mut imports_cnt: u32 = 0;
        let mut exports_cnt: u32 = 0;

        let mut parser = wasmparser::Parser::new(0);
        for payload in parser.parse_all(&engine) {
            use wasmparser::Payload::*;
            match payload {
                Ok(TypeSection(s)) => {
                    let range = s.range();
                    section_sizes.push(("type".into(), range.end - range.start));
                }
                Ok(ImportSection(s)) => {
                    let range = s.range();
                    imports_cnt = s.count();
                    section_sizes.push(("import".into(), range.end - range.start));
                }
                Ok(FunctionSection(s)) => {
                    let range = s.range();
                    functions_declared = s.count();
                    section_sizes.push(("function".into(), range.end - range.start));
                }
                Ok(TableSection(s)) => {
                    let range = s.range();
                    section_sizes.push(("table".into(), range.end - range.start));
                }
                Ok(MemorySection(s)) => {
                    let range = s.range();
                    section_sizes.push(("memory".into(), range.end - range.start));
                }
                Ok(GlobalSection(s)) => {
                    let range = s.range();
                    section_sizes.push(("global".into(), range.end - range.start));
                }
                Ok(ExportSection(s)) => {
                    let range = s.range();
                    exports_cnt = s.count();
                    section_sizes.push(("export".into(), range.end - range.start));
                }
                Ok(StartSection { range, .. }) => section_sizes.push(("start".into(), range.end - range.start)),
                Ok(ElementSection(s)) => {
                    let range = s.range();
                    section_sizes.push(("element".into(), range.end - range.start));
                }
                Ok(CodeSectionStart { .. }) => {}
                Ok(CodeSectionEntry(_)) => {}
                Ok(DataSection(s)) => {
                    let range = s.range();
                    data_bytes += range.end - range.start;
                    section_sizes.push(("data".into(), range.end - range.start));
                }
                Ok(CustomSection(cs)) => {
                    let name = cs.name().to_string();
                    let size = cs.data().len();
                    custom_sections += 1;
                    section_sizes.push((format!("custom:{name}"), size));
                }
                Ok(Version { .. }) | Ok(End(_)) => {},
                Ok(_) => {},
                Err(_) => {}
            }
        }
        // Print a concise summary
        eprintln!(
            "trace(wasm-splice:scan-sections): {} ms (imports {}, exports {}, decl funcs {}, data {} bytes, custom {})",
            t_scan.elapsed().as_millis(),
            imports_cnt,
            exports_cnt,
            functions_declared,
            data_bytes,
            custom_sections
        );
        // Top 5 largest sections
        section_sizes.sort_by(|a, b| b.1.cmp(&a.1));
        for (i, (name, sz)) in section_sizes.iter().take(5).enumerate() {
            eprintln!("trace(wasm-splice:scan-top{}): {} bytes [{}]", i + 1, sz, name);
        }
    }

    let mut module = Module::parse(&engine, false).unwrap();
    eprintln!(
        "trace(wasm-splice:parse): {} ms (engine bytes: {})",
        t_stage.elapsed().as_millis(),
        engine.len()
    );

    // since StarlingMonkey implements CLI Run and incoming handler,
    // we override them only if the guest content exports those functions
    t_stage = Instant::now();
    remove_if_exported_by_js(&mut module, &exports, "wasi:cli/run@0.2.", "#run");
    eprintln!(
        "trace(wasm-splice:remove-run-if-exported): {} ms",
        t_stage.elapsed().as_millis()
    );

    // if 'fetch-event' feature is disabled (default being default-enabled),
    // remove the built-in incoming-handler which is built around it's use.
    if !features.contains(&Feature::FetchEvent) {
        t_stage = Instant::now();
        remove_if_exported_by_js(
            &mut module,
            &exports,
            "wasi:http/incoming-handler@0.2.",
            "#handle",
        );
        eprintln!(
            "trace(wasm-splice:remove-incoming-handler): {} ms",
            t_stage.elapsed().as_millis()
        );
    }

    // we reencode the WASI world component data, so strip it out from the
    // custom section
    t_stage = Instant::now();
    let maybe_component_section_id = module
        .custom_sections
        .get_id("component-type:bindings".to_string());
    if let Some(component_section_id) = maybe_component_section_id {
        module.custom_sections.delete(component_section_id);
    }
    eprintln!(
        "trace(wasm-splice:strip-component-section): {} ms",
        t_stage.elapsed().as_millis()
    );

    // extract the native instructions from sample functions
    // then inline the imported functions and main import gating function
    // (erasing sample functions in the process)
    t_stage = Instant::now();
    let import_cnt = imports.len();
    synthesize_import_functions(&mut module, &imports, debug)?;
    eprintln!(
        "trace(wasm-splice:imports): {} ms ({} imports)",
        t_stage.elapsed().as_millis(),
        import_cnt
    );

    // create the exported functions as wrappers around the "cabi_call" function
    t_stage = Instant::now();
    let export_cnt = exports.len();
    synthesize_export_functions(&mut module, &exports)?;
    eprintln!(
        "trace(wasm-splice:exports): {} ms ({} exports)",
        t_stage.elapsed().as_millis(),
        export_cnt
    );

    t_stage = Instant::now();
    let out = module.encode();
    eprintln!(
        "trace(wasm-splice:encode): {} ms (out bytes: {})",
        t_stage.elapsed().as_millis(),
        out.len()
    );
    eprintln!(
        "trace(wasm-splice:total): {} ms",
        t_total.elapsed().as_millis()
    );
    Ok(out)
}

fn remove_if_exported_by_js(
    module: &mut Module,
    content_exports: &[(String, CoreFn)],
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
    imports: &[(String, String, CoreFn, Option<i32>)],
    debug: bool,
) -> Result<()> {
    let t_total = Instant::now();
    let mut t_stage = Instant::now();
    let mut coreabi_get_import: Option<ExportsID> = None;
    let mut cabi_realloc: Option<ExportsID> = None;

    let mut coreabi_sample_ids = Vec::new();
    t_stage = Instant::now();
    for (id, expt) in module.exports.iter().enumerate() {
        match expt.name.as_str() {
            "coreabi_sample_i32" | "coreabi_sample_i64" | "coreabi_sample_f32"
            | "coreabi_sample_f64" => coreabi_sample_ids.push(ExportsID::from(id)),
            "coreabi_get_import" => coreabi_get_import = Some(ExportsID::from(id)),
            "cabi_realloc" => cabi_realloc = Some(ExportsID::from(id)),
            _ => {}
        };
    }
    eprintln!(
        "trace(wasm-splice:imports:scan-exports): {} ms",
        t_stage.elapsed().as_millis()
    );

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
        let t_loop = Instant::now();
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
                        func.call(get_export_fid(module, &coreabi_from_bigint64));
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
                assert!(impt_sig.ret.is_none());
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
                    func.call(get_export_fid(module, &coreabi_to_bigint64));
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
        eprintln!(
            "trace(wasm-splice:imports:build-fns): {} ms ({} imports)",
            t_loop.elapsed().as_millis(),
            imports.len()
        );

        // extend the main table to include indices for generated imported functions
        t_stage = Instant::now();
        let table = module.tables.get_mut(main_tid);
        table.initial += imports.len() as u64;
        table.maximum = Some(table.maximum.unwrap() + imports.len() as u64);

        // create imported function table
        let els = module.elements.iter_mut().next().unwrap();
        if let ElementItems::Functions(ref mut funcs) = &mut els.items {
            for fid in import_fnids {
                funcs.push(fid);
            }
        }
        eprintln!(
            "trace(wasm-splice:imports:update-table): {} ms",
            t_stage.elapsed().as_millis()
        );
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
        t_stage = Instant::now();
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

        // Find the I32Const base index and compute the delta to new base
        let mut table_instr_idx = 0usize;
        let mut delta: i32 = 0;
        {
            let ops_ro = builder.body.instructions.get_ops();
            for (idx, op) in ops_ro.iter().enumerate() {
                if let Operator::I32Const { value } = op {
                    if *value < 1000 || *value > 5000 {
                        continue;
                    }
                    delta = import_fn_table_start_idx - *value;
                    table_instr_idx = idx;
                    break;
                }
            }
        }
        // Inject adjustments after the located instruction: add delta and add arg index
        builder
            .body
            .instructions
            .set_current_mode(table_instr_idx, InstrumentationMode::After);
        if delta != 0 {
            builder
                .body
                .instructions
                .add_instr(table_instr_idx, Operator::I32Const { value: delta });
            builder
                .body
                .instructions
                .add_instr(table_instr_idx, Operator::I32Add);
        }
        builder
            .body
            .instructions
            .add_instr(
                table_instr_idx,
                Operator::LocalGet {
                    local_index: *arg_idx,
                },
            );
        builder
            .body
            .instructions
            .add_instr(table_instr_idx, Operator::I32Add);
        builder
            .body
            .instructions
            .finish_instr(table_instr_idx);
        eprintln!(
            "trace(wasm-splice:imports:fixup-get-import): {} ms",
            t_stage.elapsed().as_millis()
        );
    }

    // remove unnecessary exports
    t_stage = Instant::now();
    module.exports.delete(coreabi_to_bigint64);
    module.exports.delete(coreabi_from_bigint64);
    module.exports.delete(coreabi_get_import.unwrap());
    for id in coreabi_sample_ids {
        module.exports.delete(id);
    }
    eprintln!(
        "trace(wasm-splice:imports:prune-exports): {} ms",
        t_stage.elapsed().as_millis()
    );

    eprintln!(
        "trace(wasm-splice:imports:total): {} ms",
        t_total.elapsed().as_millis()
    );

    Ok(())
}

fn synthesize_export_functions(module: &mut Module, exports: &[(String, CoreFn)]) -> Result<()> {
    let t_total = Instant::now();
    let mut t_stage = Instant::now();
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
    let t_loop = Instant::now();
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
        func.set_name(format!("post_{expt_name}"));

        // calls post_call with just the function number argument
        // internally post_call is already tracking the frees needed
        // and that is currently done based on timing assumptions of calls
        func.i32_const(export_num as i32);
        func.call(post_call);
        let fid = func.finish_module(module);
        module
            .exports
            .add_export_func(format!("cabi_post_{expt_name}"), *fid);
    }
    eprintln!(
        "trace(wasm-splice:exports:build-fns): {} ms ({} exports)",
        t_loop.elapsed().as_millis(),
        exports.len()
    );

    // remove unnecessary exports
    t_stage = Instant::now();
    module.exports.delete(call_expt);
    module.exports.delete(post_call_expt);
    eprintln!(
        "trace(wasm-splice:exports:prune-exports): {} ms",
        t_stage.elapsed().as_millis()
    );

    eprintln!(
        "trace(wasm-splice:exports:total): {} ms",
        t_total.elapsed().as_millis()
    );

    Ok(())
}
