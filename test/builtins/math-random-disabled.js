import { strictEqual, notStrictEqual, ok } from 'node:assert';

export const source = `
  export function run () {
    console.log(Math.random());
    console.log(Math.random());
  }
  export function ready () {
    return true;
  }
`;

export const disableFeatures = ['random'];

export async function test(run) {
  const { stdout, stderr } = await run();
  strictEqual(stderr, '');
  const [num1, num2] = stdout.split('\n');
  ok(Number(num1) > 0 && Number(num1) < 1);
  ok(Number(num2) > 0 && Number(num2) < 1);
  notStrictEqual(Number(num1), Number(num2));

  // NOT random
  strictEqual(Number(num1), 0.48401551228016615);
  strictEqual(Number(num2), 0.866216232534498);
}
