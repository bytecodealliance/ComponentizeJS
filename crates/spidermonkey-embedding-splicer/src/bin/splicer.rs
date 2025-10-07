use std::fs;
use std::path::PathBuf;
use std::str::FromStr;

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};

use spidermonkey_embedding_splicer::wit::exports::local::spidermonkey_embedding_splicer::splicer::{
    CoreFn, CoreTy, Feature,
};
use spidermonkey_embedding_splicer::{splice, stub_wasi};

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug, Clone)]
enum Commands {
    /// Stub WASI imports in a WebAssembly module
    StubWasi {
        /// Input WebAssembly file path
        #[arg(short, long)]
        input: PathBuf,

        /// Output WebAssembly file path
        #[arg(short, long)]
        output: PathBuf,

        /// Features to enable (multiple allowed)
        #[arg(short, long)]
        features: Vec<String>,

        /// Path to WIT file or directory
        #[arg(long)]
        wit_path: Option<PathBuf>,

        /// World name to use
        #[arg(long)]
        world_name: Option<String>,
    },

    /// Splice bindings into a WebAssembly module
    SpliceBindings {
        /// Input engine WebAssembly file path
        #[arg(short, long)]
        input: PathBuf,

        /// Output directory
        #[arg(short, long)]
        out_dir: PathBuf,

        /// Features to enable (multiple allowed)
        #[arg(short, long)]
        features: Vec<String>,

        /// Path to WIT file or directory
        #[arg(long)]
        wit_path: Option<PathBuf>,

        /// World name to use
        #[arg(long)]
        world_name: Option<String>,

        /// Enable debug mode
        #[arg(long)]
        debug: bool,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::StubWasi {
            input,
            output,
            features,
            wit_path,
            world_name,
        } => {
            let wasm = fs::read(&input)
                .with_context(|| format!("Failed to read input file: {}", input.display()))?;

            let wit_path_str = wit_path.as_ref().map(|p| p.to_string_lossy().to_string());
            let features = features
                .iter()
                .map(|v| Feature::from_str(v))
                .collect::<Result<Vec<_>>>()?;

            let result = stub_wasi::stub_wasi(wasm, features, None, wit_path_str, world_name)
                .map_err(|e| anyhow::anyhow!(e))?;

            fs::write(&output, result)
                .with_context(|| format!("Failed to write output file: {}", output.display()))?;

            println!(
                "Successfully stubbed WASI imports and saved to {}",
                output.display()
            );
        }

        Commands::SpliceBindings {
            input,
            out_dir,
            features,
            wit_path,
            world_name,
            debug,
        } => {
            if !out_dir.exists() {
                fs::create_dir_all(&out_dir).with_context(|| {
                    format!("Failed to create output directory: {}", out_dir.display())
                })?;
            }
            let engine = fs::read(&input)
                .with_context(|| format!("Failed to read input file: {}", input.display()))?;

            let wit_path_str = wit_path.as_ref().map(|p| p.to_string_lossy().to_string());

            let features = features
                .iter()
                .map(|v| Feature::from_str(v))
                .collect::<Result<Vec<_>>>()?;

            let result =
                splice::splice_bindings(engine, features, None, wit_path_str, world_name, debug)
                    .map_err(|e| anyhow::anyhow!(e))?;

            fs::write(out_dir.join("component.wasm"), result.wasm).with_context(|| {
                format!(
                    "Failed to write output file: {}",
                    out_dir.join("component.wasm").display()
                )
            })?;
            fs::write(out_dir.join("initializer.js"), result.js_bindings).with_context(|| {
                format!(
                    "Failed to write output file: {}",
                    out_dir.join("initializer.js").display()
                )
            })?;
        }
    }

    Ok(())
}
