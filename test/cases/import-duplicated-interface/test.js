import { strictEqual } from 'node:assert';

export function test(instance, args) {
  strictEqual(
    instance['actions'].call({
      actionId: '123',
      payload: { input: '' },
    }),
    ''
  );
  strictEqual(
    instance['actions'].instance.call({
      actionId: '123',
      payload: { input: '' },
    }),
    'http://example.com'
  );
}
