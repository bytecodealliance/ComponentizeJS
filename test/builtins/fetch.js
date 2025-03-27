import { URL, fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

import { strictEqual, ok } from 'node:assert';

const FETCH_URL = 'http://localhost';

export const state = async () => {
  const { getRandomPort } = await import(
    fileURLToPath(new URL('../util.js', import.meta.url))
  );
  const port = await getRandomPort();
  return { port };
};

export const source = (testState) => {
  let port = testState?.port ? ':' + testState.port : '';
  const url = FETCH_URL + port;
  console.error('[test] fetch.js visiting URL', url);
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

  // Run a local server on some port
  console.error('[test] starting local server...');
  const server = createServer(async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.write(
      JSON.stringify({
        status: 'ok',
      }),
    );
    res.end();
  }).listen(port);

  // Wait until the server is ready
  console.error('[test] waiting for server to start...');
  let ready = false;
  const url = FETCH_URL + (port ? ':' + port : '');
  while (!ready) {
    try {
      const res = await fetch(url);
      ready = true;
    } catch (err) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  console.error('[test] server started, running...');
  const { stdout, stderr } = await run();
  strictEqual(stderr, '');
  strictEqual(stdout.trim(), FETCH_URL);
}
