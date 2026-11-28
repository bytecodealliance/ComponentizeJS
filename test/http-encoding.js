import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { componentize } from '@bytecodealliance/componentize-js';
import {
  DEBUG_TEST_ENABLED,
  WEVAL_TEST_ENABLED,
  NIGHTMONKEY_TEST_ENABLED,
} from './util.js';

// Verify componentization of the HTTP world offline without invoking `getResult`
// so this regression catches adapter/encoder drift deterministically without
// network access; invoking `getResult` would make the test depend on external
// HTTP availability and conflate runtime sockets with encoding compatibility.
test('HTTP engine world remains compatible with its Preview 1 adapter', async () => {
  const source = await readFile(
    new URL('./cases/http-request/source.js', import.meta.url),
    'utf8',
  );
  const { component } = await componentize(source, {
    witPath: fileURLToPath(new URL('./wit', import.meta.url)),
    worldName: 'test2',
    enableFeatures: ['http'],
    disableFeatures: [],
    debugBuild: DEBUG_TEST_ENABLED,
    enableAot: WEVAL_TEST_ENABLED,
    enableNightmonkey: NIGHTMONKEY_TEST_ENABLED,
  });
  assert.ok(component.byteLength > 0);
});
