import * as $local$e1ab0bfa$1 from 'local:http-request/http';
import * as $local$15f12255$1 from 'local:http-request-part-two/http';

export function call(parameters) {
  console.log('call called with', parameters);
  // $local$e1ab0bfa$1.import.run('http://example.com');
  // $local$15f12255$1.import.run('http://example.com');
  return parameters;
}

export const actions = {
  call,
};
