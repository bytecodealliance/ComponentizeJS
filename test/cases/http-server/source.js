import {
  IncomingRequest,
  ResponseOutparam,
  OutgoingBody,
  OutgoingResponse,
  Fields,
} from 'wasi:http/types@0.2.3';

export const incomingHandler = {
  handle(incomingRequest, responseOutparam) {
    const outgoingResponse = new OutgoingResponse(new Fields());
    let outgoingBody = outgoingResponse.body();
    {
      let outputStream = outgoingBody.write();
      outputStream.blockingWriteAndFlush(
        new Uint8Array(new TextEncoder().encode('Hello world!')),
      );
      outputStream[Symbol.dispose]();
    }
    outgoingResponse.setStatusCode(200);
    OutgoingBody.finish(outgoingBody, undefined);
    ResponseOutparam.set(responseOutparam, {
      tag: 'ok',
      val: outgoingResponse,
    });
  },
};
