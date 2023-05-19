use anyhow::{bail, Context, Result};
use bindgen::BindingItem;
use std::path::{Path, PathBuf};
use wasmtime_environ::{
    component::{ComponentTypesBuilder, Translator},
    wasmparser::{Validator, WasmFeatures},
    ScopeVec, Tunables,
};
mod bindgen;

use wasm_encoder::{Encode, Section};
use wit_component::{ComponentEncoder, StringEncoding};
use wit_parser::{self, PackageId, Resolve, UnresolvedPackage};

wit_bindgen::generate!("spidermonkey-embedding-splicer");

use exports::*;
struct SpidermonkeyEmbeddingSplicer;

export_spidermonkey_embedding_splicer!(SpidermonkeyEmbeddingSplicer);

/// Calls [`write!`] with the passed arguments and unwraps the result.
///
/// Useful for writing to things with infallible `Write` implementations like
/// `Source` and `String`.
///
/// [`write!`]: std::write
#[macro_export]
macro_rules! uwrite {
    ($dst:expr, $($arg:tt)*) => {
        write!($dst, $($arg)*).unwrap()
    };
}

/// Calls [`writeln!`] with the passed arguments and unwraps the result.
///
/// Useful for writing to things with infallible `Write` implementations like
/// `Source` and `String`.
///
/// [`writeln!`]: std::writeln
#[macro_export]
macro_rules! uwriteln {
    ($dst:expr, $($arg:tt)*) => {
        writeln!($dst, $($arg)*).unwrap()
    };
}

mod splice;

// fn init() {
//     static INIT: Once = Once::new();
//     INIT.call_once(|| {
//         let prev_hook = std::panic::take_hook();
//         std::panic::set_hook(Box::new(move |info| {
//             console::error(&info.to_string());
//             prev_hook(info);
//         }));
//     });
// }

fn map_core_ty(cty: &bindgen::CoreTy) -> CoreTy {
    match cty {
        bindgen::CoreTy::I32 => CoreTy::I32,
        bindgen::CoreTy::I64 => CoreTy::I64,
        bindgen::CoreTy::F32 => CoreTy::F32,
        bindgen::CoreTy::F64 => CoreTy::F64,
    }
}

fn map_core_fn(cfn: &bindgen::CoreFn) -> CoreFn {
    let bindgen::CoreFn {
        params,
        ret,
        retptr,
        retsize,
        paramptr,
    } = cfn;
    CoreFn {
        params: params.iter().map(&map_core_ty).collect(),
        ret: match ret {
            Some(ref core_ty) => Some(map_core_ty(core_ty)),
            None => None,
        },
        retptr: *retptr,
        retsize: *retsize,
        paramptr: *paramptr,
    }
}

fn parse_wit(path: &Path) -> Result<(Resolve, PackageId)> {
    let mut resolve = Resolve::default();
    let id = if path.is_dir() {
        resolve.push_dir(&path)?.0
    } else {
        let contents =
            std::fs::read(&path).with_context(|| format!("failed to read file {path:?}"))?;
        let text = match std::str::from_utf8(&contents) {
            Ok(s) => s,
            Err(_) => bail!("input file is not valid utf-8"),
        };
        let pkg = UnresolvedPackage::parse(&path, text)?;
        resolve.push(pkg, &Default::default())?
    };
    Ok((resolve, id))
}

impl exports::Exports for SpidermonkeyEmbeddingSplicer {
    fn splice_bindings(
        source_name: Option<String>,
        engine: Vec<u8>,
        wit_source: Option<String>,
        wit_path: Option<String>,
        world_name: Option<String>,
    ) -> Result<SpliceResult, String> {
        // init();

        let source_name = source_name.unwrap_or("source.js".to_string());

        let (resolve, id) = if let Some(wit_source) = wit_source {
            let mut resolve = Resolve::default();
            let path = PathBuf::from("component.wit");
            let pkg = UnresolvedPackage::parse(&path, &wit_source).map_err(|e| e.to_string())?;

            let id = resolve
                .push(pkg, &Default::default())
                .map_err(|e| e.to_string())?;

            (resolve, id)
        } else {
            parse_wit(&PathBuf::from(wit_path.unwrap())).map_err(|e| e.to_string())?
        };

        let world = resolve
            .select_world(id, world_name.as_deref())
            .map_err(|e| e.to_string())?;

        let encoded = wit_component::metadata::encode(&resolve, world, StringEncoding::UTF8, None)
            .map_err(|e| e.to_string())?;

        let section = wasm_encoder::CustomSection {
            name: "component-type".into(),
            data: encoded.into(),
        };

        let mut wasm_bytes = wit_component::dummy_module(&resolve, world);
        wasm_bytes.push(section.id());
        section.encode(&mut wasm_bytes);

        // encode the core wasm into a component bindary
        let encoder = ComponentEncoder::default()
            .validate(false)
            .module(&wasm_bytes)
            .map_err(|e| format!("unable to encode wit component\n{:?}", e))?;

        let component_bytes = encoder
            .encode()
            .map_err(|e| format!("failed to encode a component from module\n{:?}", e))?;

        let scope = ScopeVec::new();
        let tunables = Tunables::default();
        let mut types = ComponentTypesBuilder::default();
        let mut validator = Validator::new_with_features(WasmFeatures {
            component_model: true,
            ..WasmFeatures::default()
        });

        let (component, _) = Translator::new(&tunables, &mut validator, &mut types, &scope)
            .translate(&component_bytes)
            .map_err(|e| format!("Failed to parse component\n{:?}", e))?;

        let componentized =
            bindgen::componentize_bindgen(&component, &resolve, world, &source_name);

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
                name, func, iface, ..
            },
        ) in &componentized.exports
        {
            if *iface {
                exports.push((format!("{export_name}#{name}"), map_core_fn(func)));
            } else {
                exports.push((export_name.to_string(), map_core_fn(func)));
            }
        }

        let mut imports = Vec::new();
        for (
            specifier,
            BindingItem {
                name, func, iface, ..
            },
        ) in &componentized.imports
        {
            if *iface {
                imports.push((
                    specifier.to_string(),
                    name.to_string(),
                    map_core_fn(func),
                    if func.retsize > 0 {
                        Some(func.retsize as i32)
                    } else {
                        None
                    },
                ));
            } else {
                imports.push((
                    specifier.to_string(),
                    "default".into(),
                    map_core_fn(func),
                    if func.retsize > 0 {
                        Some(func.retsize as i32)
                    } else {
                        None
                    },
                ));
            }
        }

        // println!("{:?}", &imports);
        // println!("{:?}", &componentized.imports);
        // println!("{:?}", &exports);
        let mut wasm = splice::splice(engine, imports, exports)?;

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
                .map(|(specifier, BindingItem { name, iface, .. })| {
                    (
                        specifier.to_string(),
                        if *iface {
                            name.to_string()
                        } else {
                            "default".into()
                        },
                    )
                })
                .collect(),
            import_wrappers: componentized.import_wrappers,
            js_bindings: generated_bindings,
        })
    }
}
