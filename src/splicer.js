import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:process';
import fs from 'node:fs';

import { splicer as wasmSplicer } from '../lib/spidermonkey-embedding-splicer.js';
import { maybeWindowsPath } from './platform.js';

/**
 * Get the path to the native splicer binary
 * @param {Object} opts - Options object
 * @returns {string} Path to the splicer binary
 */
function getSplicerBinaryPath(opts) {
	if (opts.splicerBin) {
		return opts.splicerBin;
	}
	// The splicer binary should be in target/release or target/debug
	const mode = opts?.debugBuild ? 'debug' : 'release';
	const binaryName = platform === 'win32' ? 'splicer.exe' : 'splicer';
	const splicerBinaryRelPath = `../target/${mode}/${binaryName}`;

	return fileURLToPath(new URL(splicerBinaryRelPath, import.meta.url));
}

/**
 * Run the splicer CLI with the given command and options
 * @param {string} command - The splicer command (e.g., 'splice-bindings', 'stub-wasi')
 * @param {string[]} baseArgs - Command-specific base arguments
 * @param {string[]} features - List of features to enable
 * @param {string|null} witPath - Path to WIT file or directory
 * @param {string|null} worldName - Name of the world to use
 * @param {Object} opts - Additional options (for binary path)
 * @returns {Promise<void>} Throws if the command fails
 */
async function runSplicerCli(
	command,
	baseArgs,
	features,
	witPath,
	worldName,
	opts = {},
) {
	const splicerBin = getSplicerBinaryPath(opts);

	const args = [command, ...baseArgs];

	for (const feature of features) {
		args.push('--features', feature);
	}

	// Add WIT path if provided
	if (witPath) {
		args.push('--wit-path', maybeWindowsPath(witPath));
	}

	// Add world name if provided
	if (worldName) {
		args.push('--world-name', worldName);
	}

	// Run splicer CLI
	console.error(`trace(splicer-cli:${command}): starting`);
	if (!fs.existsSync(splicerBin)) {
		throw new Error(`Failed to run splicer '${splicerBin} ${command}': splicer binary not found at ${splicerBin}`);
	}

	const process = spawnSync(splicerBin, args, {
		stdio: ['pipe', 'inherit', 'inherit'],
		encoding: 'utf-8',
	});

	if (process.status !== 0) {
		throw new Error(`Failed to run '${splicerBin} ${command}': exited with status ${process.status}`);
	}
}

/**
 * Splice bindings using the native CLI binary
 * @param {Buffer} engineWasm - The engine WASM binary
 * @param {string[]} features - List of features to enable
 * @param {string|null} witPath - Path to WIT file or directory
 * @param {string|null} worldName - Name of the world to use
 * @param {boolean} debug - Enable debug mode
 * @param {string} workDir - Working directory for temporary files
 * @param {Object} opts - Additional options (for binary path)
 * @returns {Promise<{wasm: Buffer, jsBindings: string, exports: Array, imports: Array}>}
 */
export async function spliceBindingsCli(
	engineWasm,
	features,
	witPath,
	worldName,
	debug,
	workDir,
	opts = {},
) {
	const t_start = Date.now();

	// Prepare temporary directory for splicer output
	const splicerOutDir = join(workDir, 'splicer-out');
	await mkdir(splicerOutDir);

	// Write engine wasm to temp file
	const engineInputPath = join(workDir, 'engine.wasm');
	await writeFile(engineInputPath, engineWasm);

	// Build command-specific arguments
	const baseArgs = [
		'--input', engineInputPath,
		'--out-dir', splicerOutDir,
	];

	// Add debug flag if needed
	if (debug) {
		baseArgs.push('--debug');
	}

	// Run splicer CLI
	await runSplicerCli('splice-bindings', baseArgs, features, witPath, worldName, opts);

	// Read the outputs
	const wasm = await readFile(join(splicerOutDir, 'component.wasm'));
	const jsBindings = await readFile(join(splicerOutDir, 'initializer.js'), 'utf8');
	const exports = JSON.parse(await readFile(join(splicerOutDir, 'exports.json'), 'utf8'));
	const imports = JSON.parse(await readFile(join(splicerOutDir, 'imports.json'), 'utf8'));

	const t_end = Date.now();
	console.error(`trace(splicer-cli:splice-bindings): ${t_end - t_start} ms`);

	return { wasm, jsBindings, exports, imports };
}

/**
 * Stub WASI imports using the native CLI binary
 * @param {Buffer} wasmBinary - The WASM binary to stub
 * @param {string[]} features - List of features to enable
 * @param {string|null} witPath - Path to WIT file or directory
 * @param {string|null} worldName - Name of the world to use
 * @param {string} workDir - Working directory for temporary files
 * @param {Object} opts - Additional options (for binary path)
 * @returns {Promise<Buffer>} The stubbed WASM binary
 */
export async function stubWasiCli(
	wasmBinary,
	features,
	witPath,
	worldName,
	workDir,
	opts = {},
) {
	const t_start = Date.now();

	// Write wasm to temp file for stubbing
	const stubInputPath = join(workDir, 'stub-input.wasm');
	const stubOutputPath = join(workDir, 'stub-output.wasm');
	await writeFile(stubInputPath, wasmBinary);

	// Build command-specific arguments
	const baseArgs = [
		'--input', stubInputPath,
		'--output', stubOutputPath,
	];

	// Run splicer CLI
	await runSplicerCli('stub-wasi', baseArgs, features, witPath, worldName, opts);

	// Read the stubbed wasm
	const finalBin = await readFile(stubOutputPath);

	const t_end = Date.now();
	console.error(`trace(splicer-cli:stub-wasi): ${t_end - t_start} ms`);

	return finalBin;
}

/**
 * Splice bindings using the WASM module
 * @param {Buffer} engineWasm - The engine WASM binary
 * @param {string[]} features - List of features to enable
 * @param {string|null} witWorld - WIT world source
 * @param {string|null} witPath - Path to WIT file or directory
 * @param {string|null} worldName - Name of the world to use
 * @param {boolean} debug - Enable debug mode
 * @returns {Promise<{wasm: Buffer, jsBindings: string, exports: Array, imports: Array}>}
 */
export async function spliceBindingsWasm(
	engineWasm,
	features,
	witWorld,
	witPath,
	worldName,
	debug,
) {
	const t_start = Date.now();

	const result = wasmSplicer.spliceBindings(
		engineWasm,
		features,
		witWorld,
		maybeWindowsPath(witPath),
		worldName,
		debug,
	);

	const t_end = Date.now();
	console.error(`trace(splicer-wasm:splice-bindings): ${t_end - t_start} ms`);

	return {
		wasm: Buffer.from(result.wasm),
		jsBindings: result.jsBindings,
		exports: result.exports,
		imports: result.imports,
	};
}

/**
 * Stub WASI imports using the WASM module
 * @param {Buffer} wasmBinary - The WASM binary to stub
 * @param {string[]} features - List of features to enable
 * @param {string|null} witWorld - WIT world source
 * @param {string|null} witPath - Path to WIT file or directory
 * @param {string|null} worldName - Name of the world to use
 * @returns {Promise<Buffer>} The stubbed WASM binary
 */
export async function stubWasiWasm(
	wasmBinary,
	features,
	witWorld,
	witPath,
	worldName,
) {
	const t_start = Date.now();

	const result = wasmSplicer.stubWasi(
		wasmBinary,
		features,
		witWorld,
		maybeWindowsPath(witPath),
		worldName,
	);

	const t_end = Date.now();
	console.error(`trace(splicer-wasm:stub-wasi): ${t_end - t_start} ms`);

	return Buffer.from(result);
}

