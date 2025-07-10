import { strictEqual } from 'node:assert';

import { HTTPServer } from '@bytecodealliance/preview2-shim/http';

import { getRandomPort } from '../../util.js';

export const enableFeatures = ['http', 'fetch-event'];
export const worldName = 'test3';

export async function test(instance) {
  const server = new HTTPServer(instance.incomingHandler);
  let port = await getRandomPort();
  server.listen(port);

  try {
    const resp = await fetch(`http://localhost:${port}`);
    const text = await resp.text();
    strictEqual(text, 'Hello world!');
  } finally {
    server.stop();
  }
}
