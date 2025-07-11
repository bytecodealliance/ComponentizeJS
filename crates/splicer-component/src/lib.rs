use spidermonkey_embedding_splicer::stub_wasi::stub_wasi;
use spidermonkey_embedding_splicer::wit::{self, export};
use spidermonkey_embedding_splicer::splice;
use spidermonkey_embedding_splicer::wit::exports::local::spidermonkey_embedding_splicer::splicer::{Features, Guest, SpliceResult};

struct SpidermonkeyEmbeddingSplicerComponent;

impl Guest for SpidermonkeyEmbeddingSplicerComponent {
    fn stub_wasi(
        wasm: Vec<u8>,
        features: Vec<Features>,
        wit_source: Option<String>,
        wit_path: Option<String>,
        world_name: Option<String>,
    ) -> Result<Vec<u8>, String> {
        stub_wasi(wasm, features, wit_source, wit_path, world_name).map_err(|e| e.to_string())
    }

    fn splice_bindings(
        engine: Vec<u8>,
        _features: Vec<Features>,
        world_name: Option<String>,
        wit_path: Option<String>,
        wit_source: Option<String>,
        debug: bool,
    ) -> Result<SpliceResult, String> {
        splice::splice_bindings(engine, wit_source, wit_path, world_name, debug)
    }
}

export!(SpidermonkeyEmbeddingSplicerComponent with_types_in wit);
