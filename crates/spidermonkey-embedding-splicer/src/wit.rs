use anyhow::{bail, Result};

wit_bindgen::generate!({
    world: "spidermonkey-embedding-splicer",
    pub_export_macro: true
});

use crate::wit::exports::local::spidermonkey_embedding_splicer::splicer::Feature;

impl std::str::FromStr for Feature {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self> {
        match s {
            "stdio" => Ok(Feature::Stdio),
            "clocks" => Ok(Feature::Clocks),
            "random" => Ok(Feature::Random),
            "http" => Ok(Feature::Http),
            "fetch-event" => Ok(Feature::FetchEvent),
            _ => bail!("unrecognized feature string [{s}]"),
        }
    }
}
