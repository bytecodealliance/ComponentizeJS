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
    let outgoingBody = outgoingResponse.body().val;
    {
      let outputStream = outgoingBody.write().val;
      outputStream.blockingWriteAndFlush(
        new Uint8Array(new TextEncoder().encode('Hello world!')),
      );
      outputStream[Symbol.dispose]();
    }
    outgoingResponse.setStatusCode(200);
    OutgoingBody.finish(outgoingBody, undefined);
    ResponseOutparam.set(outgoingResponse, {
      tag: 'ok',
      val: outgoingResponse,
    });
  },
};
