import { handle } from 'wasi:http/outgoing-handler@0.2.2';
import { Fields, OutgoingRequest } from 'wasi:http/types@0.2.2';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function getResult() {
  let incomingResponse;

  const req = new OutgoingRequest(
    new Fields([
      ['User-agent', encoder.encode('WASI-HTTP/0.0.1')],
      ['Content-type', encoder.encode('application/json')],
    ])
  );

  req.setScheme({ tag: 'HTTPS' });
  req.setMethod({ tag: 'get' });
  req.setPathWithQuery('/');
  req.setAuthority('webassembly.org');

  const futureIncomingResponse = handle(req);
  futureIncomingResponse.subscribe().block();
  incomingResponse = futureIncomingResponse.get().val.val;

  const status = incomingResponse.status();
  const responseHeaders = incomingResponse.headers().entries();

  const headers = Object.fromEntries(
    responseHeaders.map(([k, v]) => [k, decoder.decode(v)])
  );

  let responseBody;
  const incomingBody = incomingResponse.consume();
  {
    const bodyStream = incomingBody.stream();
    // const bodyStreamPollable = bodyStream.subscribe();
    const buf = bodyStream.blockingRead(500n);
    // TODO: actual streaming
    responseBody = buf.length > 0 ? decoder.decode(buf) : undefined;
    bodyStream[Symbol.dispose]();
  }

  return `
STATUS: ${status}
HEADERS: ${JSON.stringify(headers)}
BODY: ${responseBody}`;
}
