import { strictEqual } from 'node:assert';

import { HTTPServer } from '@bytecodealliance/preview2-shim/http';

import { getRandomPort } from '../../util.js';

export const enableFeatures = ['http'];
export const worldName = 'test3';

export async function test(instance) {
  let server;
  try {
    server = new HTTPServer(instance.incomingHandler);
    server.listen(0);
    const { port } = server.address();
    const resp = await fetch(`http://localhost:${port}`);
    const text = await resp.text();
    strictEqual(text, 'Hello world!');
  } finally {
    if (server) {
      server.stop();
    }
  }
}
