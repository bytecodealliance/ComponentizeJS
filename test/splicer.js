import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { platform } from 'node:process';

import { componentize } from '@bytecodealliance/componentize-js';
import { transpile } from '@bytecodealliance/jco';

import { suite, test, expect } from 'vitest';

import {
	DEBUG_TRACING_ENABLED,
	DEBUG_TEST_ENABLED,
	maybeLogging,
} from './util.js';

const DEBUG_BINDINGS = process.env.DEBUG_BINDINGS === '1';

/**
 * Get the path to the splicer binary
 */
function getSplicerBinaryPath() {
	const mode = DEBUG_TEST_ENABLED ? 'debug' : 'release';
	const binaryName = platform === 'win32' ? 'splicer.exe' : 'splicer';
	return fileURLToPath(
		new URL(`../target/${mode}/${binaryName}`, import.meta.url),
	);
}

/**
 * Helper to create a simple test component
 */
async function createTestComponent(splicerBin, testName) {
	const source = `
    export function add(a, b) {
      return a + b;
    }
  `;

	let componentOpts = {
		sourceName: `${testName}.js`,
		disableFeatures: maybeLogging(['random', 'clocks', 'http', 'stdio']),
		debugBuild: DEBUG_TEST_ENABLED,
		debugBindings: DEBUG_BINDINGS,
		splicerBin,
	};

	// CLI splicer needs a WIT file, WASM splicer can use inline WIT
	if (splicerBin) {
		// Write WIT to a temp file for CLI splicer
		const witContent = `
      package test:test;
      
      world test {
        export add: func(a: s32, b: s32) -> s32;
      }
    `;

		const witDir = fileURLToPath(
			new URL(`./output/${testName}-wit`, import.meta.url),
		);
		await mkdir(witDir, { recursive: true });
		await writeFile(`${witDir}/world.wit`, witContent);

		componentOpts.witPath = witDir;
	} else {
		// WASM splicer can use inline WIT
		componentOpts.witWorld = `
      package test:test;
      
      world test {
        export add: func(a: s32, b: s32) -> s32;
      }
    `;
	}

	const { component } = await componentize(source, componentOpts);

	return component;
}

/**
 * Helper to verify a component works correctly
 */
async function verifyComponent(component, testName) {
	const map = {
		'wasi:cli-base/*': '@bytecodealliance/preview2-shim/cli-base#*',
		'wasi:clocks/*': '@bytecodealliance/preview2-shim/clocks#*',
		'wasi:filesystem/*': '@bytecodealliance/preview2-shim/filesystem#*',
		'wasi:http/*': '@bytecodealliance/preview2-shim/http#*',
		'wasi:io/*': '@bytecodealliance/preview2-shim/io#*',
		'wasi:logging/*': '@bytecodealliance/preview2-shim/logging#*',
		'wasi:poll/*': '@bytecodealliance/preview2-shim/poll#*',
		'wasi:random/*': '@bytecodealliance/preview2-shim/random#*',
		'wasi:sockets/*': '@bytecodealliance/preview2-shim/sockets#*',
	};

	const { files } = await transpile(component, {
		name: testName,
		map,
		wasiShim: true,
		validLiftingOptimization: false,
		tracing: DEBUG_TRACING_ENABLED,
	});

	await mkdir(new URL(`./output/${testName}/interfaces`, import.meta.url), {
		recursive: true,
	});

	await writeFile(
		new URL(`./output/${testName}.component.wasm`, import.meta.url),
		component,
	);

	for (const file of Object.keys(files)) {
		await writeFile(
			new URL(`./output/${testName}/${file}`, import.meta.url),
			files[file],
		);
	}

	const outputPath = fileURLToPath(
		new URL(`./output/${testName}/${testName}.js`, import.meta.url),
	);

	const instance = await import(outputPath);

	// Test the exported function
	const result = instance.add(5, 3);
	expect(result).toBe(8);

	return instance;
}

suite('Splicer Integration', async () => {
	const splicerBinPath = getSplicerBinaryPath();
	const hasSplicerBinary = existsSync(splicerBinPath);

	if (hasSplicerBinary) {
		console.log(`Found splicer binary at: ${splicerBinPath}`);
	} else {
		console.warn(`Splicer binary not found at: ${splicerBinPath}`);
		console.warn('CLI splicer tests will be skipped');
	}

	test.concurrent('CLI splicer produces valid component', async () => {
		if (!hasSplicerBinary) {
			console.log('Skipping CLI splicer test - binary not found');
			return;
		}

		const component = await createTestComponent(
			splicerBinPath,
			'splicer-cli-test',
		);

		expect(component).toBeInstanceOf(Uint8Array);
		expect(component.length).toBeGreaterThan(0);

		await verifyComponent(component, 'splicer-cli-test');
	});

	test.concurrent('WASM splicer produces valid component', async () => {
		const component = await createTestComponent(
			undefined,
			'splicer-wasm-test',
		);

		expect(component).toBeInstanceOf(Uint8Array);
		expect(component.length).toBeGreaterThan(0);

		await verifyComponent(component, 'splicer-wasm-test');
	});

	test.concurrent(
		'CLI and WASM splicers produce functionally equivalent components',
		async () => {
			if (!hasSplicerBinary) {
				console.log(
					'Skipping equivalence test - CLI splicer binary not found',
				);
				return;
			}

			const cliComponent = await createTestComponent(
				splicerBinPath,
				'splicer-cli-equiv',
			);
			const wasmComponent = await createTestComponent(
				undefined,
				'splicer-wasm-equiv',
			);

			// Both should produce valid components
			expect(cliComponent).toBeInstanceOf(Uint8Array);
			expect(wasmComponent).toBeInstanceOf(Uint8Array);

			// Verify both work correctly
			const cliInstance = await verifyComponent(
				cliComponent,
				'splicer-cli-equiv',
			);
			const wasmInstance = await verifyComponent(
				wasmComponent,
				'splicer-wasm-equiv',
			);

			// Both should produce the same result
			expect(cliInstance.add(10, 20)).toBe(30);
			expect(wasmInstance.add(10, 20)).toBe(30);
			expect(cliInstance.add(10, 20)).toBe(wasmInstance.add(10, 20));
		},
	);

	test.concurrent('custom splicer binary path works', async () => {
		if (!hasSplicerBinary) {
			console.log('Skipping custom path test - binary not found');
			return;
		}

		// Test with explicit path
		const component = await createTestComponent(
			splicerBinPath,
			'splicer-custom-path',
		);

		expect(component).toBeInstanceOf(Uint8Array);
		await verifyComponent(component, 'splicer-custom-path');
	});

	test.concurrent('invalid splicer binary path throws error', async () => {
		const invalidPath = '/nonexistent/path/to/splicer';

		await expect(
			createTestComponent(invalidPath, 'splicer-invalid-path'),
		).rejects.toThrow(/splicer binary not found/);
	});

	test.concurrent(
		'CLI splicer with WIT path produces valid component',
		async () => {
			if (!hasSplicerBinary) {
				console.log('Skipping WIT path test - binary not found');
				return;
			}

			const source = `
        export function add(a, b) {
          return a + b;
        }

        export function getResult() {
          return 42;
        }
      `;

			const witPath = fileURLToPath(new URL('./wit', import.meta.url));

			const { component } = await componentize(source, {
				sourceName: 'cli-wit-path-test.js',
				witPath,
				worldName: 'test2',
				disableFeatures: maybeLogging([]),
				debugBuild: DEBUG_TEST_ENABLED,
				debugBindings: DEBUG_BINDINGS,
				splicerBin: splicerBinPath,
			});

			expect(component).toBeInstanceOf(Uint8Array);
			expect(component.length).toBeGreaterThan(0);
		},
	);

	test.concurrent(
		'WASM splicer with WIT path produces valid component',
		async () => {
			const source = `
        export function add(a, b) {
          return a + b;
        }
        
        export function getResult() {
          return 42;
        }
      `;

			const witPath = fileURLToPath(new URL('./wit', import.meta.url));

			const { component } = await componentize(source, {
				sourceName: 'wasm-wit-path-test.js',
				witPath,
				worldName: 'test2',
				disableFeatures: maybeLogging([]),
				debugBuild: DEBUG_TEST_ENABLED,
				debugBindings: DEBUG_BINDINGS,
				splicerBin: undefined,
			});

			expect(component).toBeInstanceOf(Uint8Array);
			expect(component.length).toBeGreaterThan(0);
		},
	);
});

