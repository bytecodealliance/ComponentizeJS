import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, toNamespacedPath } from 'node:path';
import { preopens } from '@bytecodealliance/preview2-shim/filesystem';
import { afterAll, assert, beforeAll, expect, suite, test, vi } from 'vitest';

import * as generatedSplicer from '../lib/spidermonkey-embedding-splicer.js';
import { createSplicer } from '../src/splicer.js';

const emptyModule = Uint8Array.from([0, 97, 115, 109, 1, 0, 0, 0]);
const features = ['stdio', 'random', 'clocks', 'http', 'fetch-event'];
let tempDir;
let firstDir;
let secondDir;
let witFile;

function readWorld({ splicer, witPath }, worldName, witWorld) {
  const wasm = splicer.stubWasi(
    emptyModule, features, witWorld, witPath, worldName,
  );
  assert.isTrue(WebAssembly.validate(wasm));
}

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'componentize-splicer-'));
  firstDir = join(tempDir, 'first world');
  secondDir = join(tempDir, 'second world');
  witFile = join(firstDir, 'world file.wit');
  await mkdir(join(firstDir, 'deps', 'dependency'), { recursive: true });
  await mkdir(secondDir);
  await writeFile(witFile, 'package test:first; world first {}');
  await writeFile(
    join(secondDir, 'world.wit'),
    'package test:second; world second {}',
  );
  await writeFile(
    join(firstDir, 'dependent.wit'),
    'package test:first; world dependent { import test:dependency/api; }',
  );
  await writeFile(
    join(firstDir, 'deps', 'dependency', 'api.wit'),
    'package test:dependency; interface api { ping: func(); }',
  );
});

afterAll(async () => {
  if (tempDir) await rm(tempDir, { recursive: true });
});

suite('Splicer filesystem', () => {
  test('reads absolute and relative WIT files with spaces', async () => {
    for (const path of [witFile, relative(process.cwd(), witFile)]) {
      const instance = await createSplicer(path);
      assert.equal(instance.witPath, '/wit/world file.wit');
      readWorld(instance, 'first');
    }
  });

  test('reads a WIT directory and its dependency tree', async () => {
    const instance = await createSplicer(firstDir);
    assert.equal(instance.witPath, '/wit');
    readWorld(instance, 'dependent');
  });

  test('keeps concurrent instances and global preopens isolated', async () => {
    const originalPreopens = preopens.getDirectories().slice();
    const [first, second] = await Promise.all([
      createSplicer(firstDir),
      createSplicer(secondDir),
    ]);
    assert.notStrictEqual(first.splicer, second.splicer);
    readWorld(first, 'first');
    readWorld(second, 'second');
    assert.throws(() => readWorld(first, 'second'), /World `second` not found/);
    assert.throws(() => readWorld(second, 'first'), /World `first` not found/);
    assert.deepEqual(preopens.getDirectories(), originalPreopens);
  });

  test('does not expose host paths outside the WIT tree', async () => {
    const instance = await createSplicer(firstDir);
    assert.throws(
      () => readWorld({ ...instance, witPath: join(secondDir, 'world.wit') }, 'second'),
      /reading file/,
    );
    assert.throws(
      () => readWorld({ ...instance, witPath: '/wit/../second world/world.wit' }, 'second'),
      /reading file/,
    );
  });

  test('inline WIT works without granting filesystem access', async () => {
    const instance = await createSplicer();
    readWorld(instance, 'inline', 'package test:inline; world inline {}');
    assert.throws(
      () => readWorld({ ...instance, witPath: witFile }, 'first'),
      /reading file/,
    );
  });

  test('resolves a symlinked WIT directory', async () => {
    const link = join(tempDir, 'linked world');
    await symlink(await realpath(firstDir), link, 'junction');
    readWorld(await createSplicer(link), 'dependent');
  });

  test('reports missing and empty WIT paths', async () => {
    for (const path of [join(tempDir, 'missing.wit'), '']) {
      await expect(createSplicer(path)).rejects.toMatchObject({ code: 'ENOENT' });
    }
  });

  test.runIf(process.platform === 'win32')('reads namespaced Windows paths', async () => {
    readWorld(await createSplicer(toNamespacedPath(witFile)), 'first');
    readWorld(await createSplicer(toNamespacedPath(firstDir)), 'dependent');
  });

  test('reuses concurrent calls with the same filesystem scope', async () => {
    const [inline, repeated, file, directory] = await Promise.all([
      createSplicer(),
      createSplicer(),
      createSplicer(witFile),
      createSplicer(firstDir),
    ]);
    assert.strictEqual(inline.splicer, repeated.splicer);
    assert.strictEqual(file.splicer, directory.splicer);
    assert.notStrictEqual(inline.splicer, file.splicer);
    assert.equal(file.witPath, '/wit/world file.wit');
    assert.equal(directory.witPath, '/wit');
  });

  test('evicts the least recently used scope without retargeting live instances', async () => {
    const first = await createSplicer(firstDir);
    const second = await createSplicer(secondDir);
    assert.strictEqual((await createSplicer(firstDir)).splicer, first.splicer);
    await createSplicer();
    assert.strictEqual((await createSplicer(firstDir)).splicer, first.splicer);
    const replacement = await createSplicer(secondDir);
    assert.notStrictEqual(replacement.splicer, second.splicer);
    readWorld(first, 'first');
    readWorld(second, 'second');
    readWorld(replacement, 'second');
    assert.throws(() => readWorld(second, 'first'), /World `first` not found/);
  });

  test('does not cache failed instantiation', async () => {
    const directory = await mkdtemp(join(tempDir, 'retry-'));
    const error = new Error('Splicer initialization failed');
    const instantiate = vi.spyOn(generatedSplicer, 'instantiate')
      .mockRejectedValueOnce(error);
    try {
      await expect(createSplicer(directory)).rejects.toBe(error);
      await expect(createSplicer(directory)).resolves.toHaveProperty('splicer');
      expect(instantiate).toHaveBeenCalledTimes(2);
    } finally {
      instantiate.mockRestore();
    }
  });
});
