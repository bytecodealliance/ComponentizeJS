import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { copyFile, mkdtemp } from 'node:fs/promises';

import { suite, test, assert } from 'vitest';

import { setupComponent } from "./util.js";

import {
    DEBUG_TRACING_ENABLED,
    DEBUG_TEST_ENABLED,
} from './util.js';

suite('API', () => {
    // When using a different directory sourcePath as an arg to componentize()
    // (called via setupComponent() in this test), wizer would fail to initialize the component
    // due to a missing file -- the path prefix stripping was not correctly being resolved.
    test('componentize() in a different dir', async () => {
        const tmpDir = await mkdtemp(join(tmpdir(), 'componentize-diff-dir-'));
        const outputPath = join(tmpDir, "index.js");
        await copyFile(resolve('./test/api/index.js'), outputPath);
        const { instance } = await setupComponent({
            componentize: {
                opts: {
                    sourcePath: outputPath,
                    witPath: fileURLToPath(new URL('./wit', import.meta.url)),
                    worldName: 'test1',
                    debugBuild: DEBUG_TEST_ENABLED,
                },
            },
            transpile: {
                opts: {
                    tracing: DEBUG_TRACING_ENABLED,
                },
            },
        });
    });
});
