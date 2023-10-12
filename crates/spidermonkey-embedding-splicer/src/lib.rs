use anyhow::{bail, Context, Result};
use bindgen::BindingItem;
use std::path::{Path, PathBuf};

mod bindgen;
mod splice;
mod stub_wasi;

use crate::stub_wasi::stub_wasi;

use wasm_encoder::{Encode, Section};
use wit_component::StringEncoding;
use wit_parser::{self, PackageId, Resolve, UnresolvedPackage};

wit_bindgen::generate!({
    world: "spidermonkey-embedding-splicer",
    exports: {
        world: SpidermonkeyEmbeddingSplicerComponent
    }
});

struct SpidermonkeyEmbeddingSplicerComponent;

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
        resolve.push(pkg)?
    };
    Ok((resolve, id))
}

impl Guest for SpidermonkeyEmbeddingSplicerComponent {
    fn stub_wasi(wasm: Vec<u8>, stdout: bool) -> Result<Vec<u8>, String> {
        stub_wasi(wasm, stdout).map_err(|e| e.to_string())
    }

    fn splice_bindings(
        source_name: Option<String>,
        engine: Vec<u8>,
        wit_source: Option<String>,
        wit_path: Option<String>,
        world_name: Option<String>,
    ) -> Result<SpliceResult, String> {
        let source_name = source_name.unwrap_or("source.js".to_string());

        let (resolve, id) = if let Some(wit_source) = wit_source {
            let mut resolve = Resolve::default();
            let path = PathBuf::from("component.wit");
            let pkg = UnresolvedPackage::parse(&path, &wit_source).map_err(|e| e.to_string())?;

            let id = resolve.push(pkg).map_err(|e| e.to_string())?;

            (resolve, id)
        } else {
            parse_wit(&PathBuf::from(wit_path.unwrap())).map_err(|e| format!("{:?}", e))?
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

        let componentized = bindgen::componentize_bindgen(&resolve, world, &source_name);

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

        // println!("{:?}", &imports);
        // println!("{:?}", &componentized.imports);
        // println!("{:?}", &exports);
        let mut wasm =
            splice::splice(engine, imports, exports, false).map_err(|e| format!("{:?}", e))?;

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
            import_wrappers: componentized.import_wrappers,
            js_bindings: generated_bindings,
        })
    }
}
