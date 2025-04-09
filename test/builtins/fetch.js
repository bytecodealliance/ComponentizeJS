import { URL, fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

import { strictEqual, ok } from 'node:assert';

import { maybeWindowsPath } from '../../src/platform.js';

const FETCH_URL = 'http://localhost';

export const state = async () => {
  const { getRandomPort } = await import(
    maybeWindowsPath(fileURLToPath(new URL('../util.js', import.meta.url)))
  );
  const port = await getRandomPort();
  return { port };
};

export const source = (testState) => {
  let port = testState?.port ? ':' + testState.port : '';
  const url = FETCH_URL + port;
  return `
  export async function run () {
    const res = await fetch('${url}');
    const source = await res.json();
    console.log(source.url);
  }
  export function ready () {
    return true;
  }
`;
};

export const enableFeatures = ['http'];

export async function test(run, testState) {
  // Get the randomly generated port
  const port = testState.port;
  if (!port) {
    throw new Error('missing port on test state');
  }

  const url = FETCH_URL + (port ? ':' + port : '');

  // Run a local server on some port
  const server = createServer(async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.write(
      JSON.stringify({
        status: 'ok',
        url,
      }),
    );
    res.end();
  }).listen(port);

  // Wait until the server is ready
  let ready = false;
  while (!ready) {
    try {
      const res = await fetch(url);
      ready = true;
    } catch (err) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  const { stdout, stderr } = await run();
  strictEqual(stderr, '');
  strictEqual(stdout.trim(), url);

  server.close();
}
