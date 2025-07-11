use anyhow::{bail, Result};

wit_bindgen::generate!({
    world: "spidermonkey-embedding-splicer",
    pub_export_macro: true
});

use crate::wit::exports::local::spidermonkey_embedding_splicer::splicer::Features;

impl std::str::FromStr for Features {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self> {
        match s {
            "stdio" => Ok(Features::Stdio),
            "clocks" => Ok(Features::Clocks),
            "random" => Ok(Features::Random),
            "http" => Ok(Features::Http),
            "fetch-event" => Ok(Features::FetchEvent),
            _ => bail!("unrecognized feature string [{s}]"),
        }
    }
}
