use anyhow::{bail, Context, Result};
use std::path::Path;

pub mod bindgen;
pub mod splice;
pub mod stub_wasi;

use crate::wit::{CoreFn, CoreTy};
use wit_parser::{PackageId, Resolve};

pub mod wit {
    wit_bindgen::generate!({
        world: "spidermonkey-embedding-splicer",
        pub_export_macro: true
    });
}

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

fn parse_wit(path: impl AsRef<Path>) -> Result<(Resolve, PackageId)> {
    let mut resolve = Resolve::default();
    let path = path.as_ref();
    let id = if path.is_dir() {
        resolve
            .push_dir(&path)
            .with_context(|| format!("resolving WIT in {}", path.display()))?
            .0
    } else {
        let contents =
            std::fs::read(&path).with_context(|| format!("reading file {}", path.display()))?;
        let text = match std::str::from_utf8(&contents) {
            Ok(s) => s,
            Err(_) => bail!("input file is not valid utf-8"),
        };
        resolve.push_str(&path, text)?
    };
    Ok((resolve, id))
}
