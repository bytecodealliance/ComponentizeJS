use anyhow::Result;
use heck::ToLowerCamelCase;
use js_component_bindgen::{transpile, GenerationOpts, Transpiled};
use std::collections::HashSet;
use std::{path::PathBuf, sync::Once};
use wasm_encoder::{Encode, Section};
use wasmtime_environ::component::{ComponentTypesBuilder, Translator};
use wasmtime_environ::wasmparser::{Validator, WasmFeatures};
use wasmtime_environ::{ScopeVec, Tunables};
use wit_component::{ComponentEncoder, StringEncoding};
use wit_parser::SizeAlign;
use wit_parser::{self, abi::AbiVariant, Resolve, UnresolvedPackage, WorldId, WorldItem};

wit_bindgen::generate!("spidermonkey-embedding-splicer");

use exports::*;
struct SpidermonkeyEmbeddingSplicer;

export_spidermonkey_embedding_splicer!(SpidermonkeyEmbeddingSplicer);

mod splice;

fn init() {
    static INIT: Once = Once::new();
    INIT.call_once(|| {
        let prev_hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            console::error(&info.to_string());
            prev_hook(info);
        }));
    });
}

struct ExportBinding {
    export_name: String,
    member_name: Option<String>,
    retsize: u32,
    retptr: bool,
    paramptr: bool,
    args: Vec<CoreTy>,
    ret: Option<CoreTy>,
    lowering_name: String,
    lifting_name: String,
}

impl exports::Exports for SpidermonkeyEmbeddingSplicer {
    fn splice_bindings(
        source_name: Option<String>,
        engine: Vec<u8>,
        wit_world: String,
        wit_path: Option<String>,
    ) -> Result<SpliceResult, String> {
        init();

        let source_name = source_name.unwrap_or("source.js".to_string());
        let mut resolve = Resolve::default();

        // Singular inversion invariant:
        // - dummy generation is only for imports and exports, so there will only
        //   be a single memory, single realloc, and exports objects for the import and export interfaces
        //   (memory0, realloc0, exports0..n)

        let world: WorldId = {
            // synthesise a dummy component from the provided wit
            let path = PathBuf::from(wit_path.as_deref().unwrap_or("component.wit"));

            // TODO: support resolution via parse_file and WASI preview2 support for the JS component
            let pkg = UnresolvedPackage::parse(&path, &wit_world).map_err(|e| e.to_string())?;
            let id = resolve
                .push(pkg, &Default::default())
                .map_err(|e| e.to_string())?;

            let docs = &resolve.packages[id];
            let (_, doc) = docs.documents.first().unwrap();

            let world = match resolve.documents[*doc].default_world {
                Some(world) => world,
                None => return Err("no default world found in document".into()),
            };

            // for (name, wasm) in adapters.iter() {
            //     encoder = encoder.adapter(name, wasm)?;
            // }

            world
        };

        let mut imports = Vec::new();

        let mut import_bindings: Vec<(String, Vec<(String, String)>)> = Vec::new();

        let mut impt_binding_interface_exports = Vec::new();
        let mut impt_binding_func_exports = Vec::new();

        let mut sa = SizeAlign::default();
        sa.fill(&resolve);

        for (impt_name, import) in resolve.worlds[world].imports.iter() {
            let impt_name_js = impt_name.to_lower_camel_case();
            match import {
                WorldItem::Interface(iface) => {
                    let mut specifier_bindings = Vec::new();
                    for (name, func) in resolve.interfaces[*iface].functions.iter() {
                        let sig = resolve.wasm_signature(AbiVariant::GuestImport, func);
                        let ret = if !sig.retptr {
                            None
                        } else {
                            let mut ret_size: i32 = 0;
                            for ret_ty in func.results.iter_types() {
                                ret_size += sa.size(ret_ty) as i32;
                            }
                            Some(ret_size)
                        };
                        imports.push((impt_name.to_string(), name.clone(), sig, ret));
                        let name_js = name.to_lower_camel_case();
                        let binding_name = format!("import_{impt_name_js}${name_js}");
                        impt_binding_interface_exports
                            .push(format!("{} = {}.{}", binding_name, impt_name_js, name_js));
                        specifier_bindings.push((name.to_string(), binding_name));
                    }
                    import_bindings.push((impt_name.into(), specifier_bindings));
                }
                WorldItem::Function(func) => {
                    let sig = resolve.wasm_signature(AbiVariant::GuestImport, func);
                    let ret = if !sig.retptr {
                        None
                    } else {
                        let mut ret_size: i32 = 0;
                        for ret_ty in func.results.iter_types() {
                            ret_size += sa.size(ret_ty) as i32;
                        }
                        Some(ret_size)
                    };
                    imports.push((impt_name.to_string(), impt_name_js.to_string(), sig, ret));
                    let binding_name = format!("import_{impt_name_js}");
                    impt_binding_func_exports.push(format!("{} as {}", impt_name_js, binding_name));
                    import_bindings.push((
                        impt_name.into(),
                        vec![("$default".to_string(), binding_name)],
                    ));
                }
                WorldItem::Type(_) => {}
            }
        }

        let (generated_bindings, mut export_bindings, exports, global_initializers) = {
            let mut resolve_inverted = Resolve::default();

            let path = PathBuf::from(wit_path.as_deref().unwrap_or("component.wit"));

            let pkg = UnresolvedPackage::parse(&path, &wit_world).map_err(|e| e.to_string())?;

            let id = resolve_inverted
                .push(pkg, &Default::default())
                .map_err(|e| e.to_string())?;

            let docs = &resolve_inverted.packages[id];
            let (_, doc) = docs.documents.first().unwrap();

            let world = match resolve_inverted.documents[*doc].default_world {
                Some(world) => world,
                None => return Err("no default world found in document".into()),
            };

            // perform inversion: imports -> exports, exports -> imports
            // drain both into temporary vectors first
            let mut drained_impts: Vec<(String, WorldItem)> =
                resolve_inverted.worlds[world].imports.drain(..).collect();
            let mut drained_expts: Vec<(String, WorldItem)> =
                resolve_inverted.worlds[world].exports.drain(..).collect();

            for (key, impt) in drained_impts.drain(..) {
                resolve_inverted.worlds[world].exports.insert(key, impt);
            }

            for (key, expt) in drained_expts.drain(..) {
                resolve_inverted.worlds[world].imports.insert(key, expt);
            }

            let mut sa = SizeAlign::default();
            sa.fill(&resolve_inverted);

            let encoded = wit_component::metadata::encode(
                &resolve_inverted,
                world,
                StringEncoding::UTF8,
                None,
            )
            .map_err(|e| e.to_string())?;

            let section = wasm_encoder::CustomSection {
                name: "component-type",
                data: &encoded,
            };

            let mut wasm_bytes = wit_component::dummy_module(&resolve_inverted, world);
            wasm_bytes.push(section.id());
            section.encode(&mut wasm_bytes);

            // encode the core wasm into a component bindary
            let encoder = ComponentEncoder::default()
                .validate(false)
                .module(&wasm_bytes)
                .map_err(|e| format!("unable to encode wit component\n{:?}", e))?;

            // bindgen the js
            let mut opts = GenerationOpts::default();
            opts.name = "test".to_string();
            opts.no_typescript = true;
            opts.valid_lifting_optimization = true;
            opts.compat = false;
            opts.base64_cutoff = 0;
            opts.raw_bindgen = true;

            let component_bytes = encoder
                .encode()
                .map_err(|e| format!("failed to encode a component from module\n{:?}", e))?;

            let Transpiled { files, .. } =
                transpile(component_bytes.clone(), opts).map_err(|e| format!("{:?}", e))?;

            let js_source = &files
                .iter()
                .find(|(name, _)| name == "test.js")
                .take()
                .unwrap()
                .1;

            let scope = ScopeVec::new();
            let tunables = Tunables::default();
            let mut types = ComponentTypesBuilder::default();
            let mut validator = Validator::new_with_features(WasmFeatures {
                component_model: true,
                ..WasmFeatures::default()
            });
            let (component, _) = Translator::new(&tunables, &mut validator, &mut types, &scope)
                .translate(&component_bytes)
                .unwrap();

            let mut generated_bindings = String::from_utf8(js_source.to_vec())
                .map_err(|e| format!("unable to read bindings source\n{:?}", e))?;

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
            for i in 0..imports.len() {
                if generated_bindings.contains(&format!("postReturn{}", i)) {
                    generated_bindings =
                        generated_bindings.replace(&format!("postReturn{}(ret);", i), ";");
                }
            }
            generated_bindings =
                generated_bindings.replace("const instantiateCore = WebAssembly.instantiate;", "");

            let mut exports = Vec::new();
            let mut export_bindings: Vec<ExportBinding> = Vec::new();
            for init in component.initializers.iter() {
                if let wasmtime_environ::component::GlobalInitializer::LowerImport(import) = init {
                    let (import_index, path) = &component.imports[import.import];
                    let (import_name, _import_ty) = &component.import_types[*import_index];
                    let (func, iface) =
                        match &resolve_inverted.worlds[world].imports[import_name.as_str()] {
                            WorldItem::Function(f) => {
                                assert_eq!(path.len(), 0);
                                exports.push((
                                    f.name.to_string(),
                                    resolve_inverted.wasm_signature(AbiVariant::GuestExport, f),
                                ));
                                (f, false)
                            }
                            WorldItem::Interface(i) => {
                                assert_eq!(path.len(), 1);
                                let iface = &resolve_inverted.interfaces[*i];
                                let func = &iface.functions[&path[0]];
                                let name = &func.name;
                                exports.push((
                                    format!("{import_name}#{name}"),
                                    resolve_inverted.wasm_signature(AbiVariant::GuestExport, func),
                                ));
                                (func, true)
                            }
                            WorldItem::Type(_) => panic!("Unexpected type lowering"),
                        };
                    let sig = resolve_inverted.wasm_signature(AbiVariant::GuestExport, func);
                    let mut retsize: u32 = 0;
                    if sig.retptr {
                        for ret_ty in func.results.iter_types() {
                            retsize += sa.size(ret_ty) as u32;
                        }
                    }
                    let index = import.index.as_u32();
                    export_bindings.push(ExportBinding {
                        retsize,
                        export_name: import_name.to_string(),
                        member_name: if iface {
                            Some(func.name.to_string())
                        } else {
                            None
                        },
                        lifting_name: format!("lowering{index}Callee"),
                        lowering_name: format!("lowering{index}"),
                        retptr: sig.retptr,
                        paramptr: sig.indirect_params,
                        args: sig
                            .params
                            .iter()
                            .map(|v| match v {
                                wit_parser::abi::WasmType::I32 => CoreTy::I32,
                                wit_parser::abi::WasmType::I64 => CoreTy::I64,
                                wit_parser::abi::WasmType::F32 => CoreTy::F32,
                                wit_parser::abi::WasmType::F64 => CoreTy::F64,
                            })
                            .collect(),
                        ret: match sig.results.first() {
                            None => None,
                            Some(wit_parser::abi::WasmType::I32) => Some(CoreTy::I32),
                            Some(wit_parser::abi::WasmType::I64) => Some(CoreTy::I64),
                            Some(wit_parser::abi::WasmType::F32) => Some(CoreTy::F32),
                            Some(wit_parser::abi::WasmType::F64) => Some(CoreTy::F64),
                        },
                    });
                }
            }

            (
                generated_bindings,
                export_bindings,
                exports,
                component.initializers,
            )
        };

        // console::log(&format!("{:?}", &imports));
        // console::log(&format!("{:?}", &exports));
        let mut wasm = splice::splice(engine, imports, exports)?;

        // add the world section to the spliced wasm
        let encoded = wit_component::metadata::encode(&resolve, world, StringEncoding::UTF8, None)
            .map_err(|e| e.to_string())?;

        let section = wasm_encoder::CustomSection {
            name: "component-type",
            data: &encoded,
        };
        wasm.push(section.id());
        section.encode(&mut wasm);

        // embed the new world type in the spliced component
        let mut js_bindings = String::new();
        js_bindings.push_str(&format!("import * as source_mod from '{source_name}';\n"));

        if export_bindings.len() > 0 {
            // error handling
            js_bindings.push_str(&format!(
"class BindingsError extends Error {{
    constructor (interfaceName, interfaceType) {{
        super(`Export \"${{interfaceName}}\" ${{interfaceType}} not exported as expected by the world for \"{source_name}\".`);
    }}
}}\n"
            ));
            let mut seen_ifaces = HashSet::new();
            for binding in &export_bindings {
                let expt_name_camel = binding.export_name.to_lower_camel_case();
                if let Some(name) = &binding.member_name {
                    let name_camel = name.to_lower_camel_case();
                    if !seen_ifaces.contains(&expt_name_camel) {
                        seen_ifaces.insert(expt_name_camel.to_string());
                        js_bindings.push_str(&format!(
                            "if (typeof source_mod['{expt_name_camel}'] !== 'object') throw new BindingsError('{expt_name_camel}', 'object');\n"
                        ));
                    }
                    js_bindings.push_str(&format!(
                        "if (typeof source_mod['{expt_name_camel}']['{name_camel}'] !== 'function') throw new BindingsError('{expt_name_camel}.{name_camel}', 'function');\n"
                    ));
                    let lifting_name = &binding.lifting_name;
                    js_bindings.push_str(&format!(
                        "const {lifting_name} = source_mod.{expt_name_camel}.{name_camel};\n"
                    ));
                } else {
                    js_bindings.push_str(&format!(
                        "if (typeof source_mod['{expt_name_camel}'] !== 'function') throw new BindingsError('{expt_name_camel}', 'function');\n"
                    ));
                    let lifting_name = &binding.lifting_name;
                    js_bindings.push_str(&format!(
                        "const {lifting_name} = source_mod.{expt_name_camel};\n"
                    ));
                }
            }
        }
        js_bindings.push_str("\nexport function $initBindings (_memory0, _realloc0");
        let mut import_binding_idx = 0;
        for (_, binding_list) in import_bindings.iter() {
            for _ in binding_list {
                js_bindings.push_str(&format!(", _import{import_binding_idx}"));
                import_binding_idx += 1;
            }
        }
        js_bindings.push_str(") {\n");
        // js bindgen doesn't define unused bindings so we must check
        if generated_bindings.contains("let memory0") {
            js_bindings.push_str("  memory0 = _memory0;\n");
        }
        let mut def_realloc = false;
        if generated_bindings.contains("let realloc0") {
            js_bindings.push_str("  realloc0 = _realloc0;\n");
        } else {
            def_realloc = true;
            js_bindings.push_str("  realloc0 = _realloc0;\n");
        }

        if import_bindings.len() > 0 {
            // match up "exports{idx}" to their global instance indices by the global
            // initializer ordering. This works due to the dummy component assumptions.
            let mut export_idx = 0;
            for init in global_initializers {
                match init {
                    wasmtime_environ::component::GlobalInitializer::InstantiateModule(x) => match x
                    {
                        wasmtime_environ::component::InstantiateModule::Static(idx, _) => {
                            export_idx = idx.as_u32();
                            break;
                        }
                        _ => {}
                    },
                    _ => {}
                }
            }
            js_bindings.push_str(&format!("  exports{export_idx} = {{\n"));
            import_binding_idx = 0;
            for (impt_name, binding_list) in import_bindings.iter() {
                for (binding_name, _) in binding_list.iter() {
                    js_bindings.push_str(&format!(
                        "    '{impt_name}#{binding_name}': _import{import_binding_idx},\n"
                    ));
                    import_binding_idx += 1;
                }
            }
            js_bindings.push_str("  };\n");
        }
        js_bindings.push_str("}\n");
        if def_realloc {
            js_bindings.push_str("let realloc0;\n");
        }
        js_bindings.push_str(&generated_bindings);
        js_bindings.push_str("\n");

        // imports
        if impt_binding_interface_exports.len() > 0 {
            js_bindings.push_str("export const ");
            js_bindings.push_str(&impt_binding_interface_exports.join(", "));
            js_bindings.push_str(";\n");
        }
        // function import exports are ambient to help TDZ
        if impt_binding_func_exports.len() > 0 {
            js_bindings.push_str("export {");
            js_bindings.push_str(&impt_binding_func_exports.join(", "));
            js_bindings.push_str("}\n");
        }

        let mut export_core_fns: Vec<ExportCoreFn> = Vec::new();

        // exports
        let mut exports = Vec::new();
        if export_bindings.len() > 0 {
            js_bindings.push_str("export { ");
            for binding in export_bindings.drain(..) {
                export_core_fns.push(ExportCoreFn {
                    retsize: binding.retsize,
                    retptr: binding.retptr,
                    paramptr: binding.paramptr,
                    name: binding.lowering_name.to_string(),
                    args: binding.args,
                    ret: binding.ret,
                });
                exports.push(binding.lowering_name);
            }
            js_bindings.push_str(&exports.join(", "));
            js_bindings.push_str(" }");
        }
        js_bindings.push_str("\n");

        let mut import_wrappers = Vec::new();
        let mut imports = Vec::new();
        for (impt_name, binding_list) in import_bindings.iter() {
            let mut bindings = Vec::new();
            let mut specifier_list = Vec::new();
            for (binding_name, local_binding) in binding_list.iter() {
                bindings.push(if binding_name == "$default" {
                    impt_name.to_lower_camel_case()
                } else {
                    binding_name.to_string()
                });

                let lower_camel_binding_name = binding_name.to_lower_camel_case();
                specifier_list.push(format!("{local_binding} as {lower_camel_binding_name}"));
            }
            let joined_bindings = specifier_list.join(", ");
            import_wrappers.push((
                impt_name.to_string(),
                format!("export {{ {joined_bindings} }} from 'internal:bindings';"),
            ));
            imports.push((impt_name.to_string(), bindings));
        }

        Ok(SpliceResult {
            wasm,
            export_core_fns,
            imports,
            import_wrappers,
            js_bindings,
        })
    }
}
