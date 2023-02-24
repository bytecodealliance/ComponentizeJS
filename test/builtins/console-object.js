import { strictEqual } from 'node:assert';

export const source = `
  export function run () {
    class Z {
      func () {
    
      } 
    }
    const o = {
      a: {
        value: 'a',
      },
      b: {
        c: 'd'
      },
      e: ['f'],
      g: [{
        g: 'i'
      }],
      l () {
  
      },
      get m () {
  
      },
      set n (v) {
  
      },
      o: function () {
  
      },
      p: () => {},
      q: 5,
      s: 29879287298374923,
      t: new Set([1, 2, 3]),
      u: new Map([[1, 2], [3, 4], [function foo () {}, {}]]),
      v: Symbol.for('blah'),
      w: Symbol(),
      x: undefined,
      y: null,
      z: null, // new URL('https://site.com/x?a&b'),
      zz: new Uint8Array([1,2,3]),
      zzz: new Z()
    };
    Object.defineProperty(o, 'hidden', { value: 'hidden', enumerable: false });
    console.log(o);
  }
`;

export async function test (run) {
  const { stdout, stderr } = await run();
  strictEqual(stderr, `{ a: { value: "a" }, b: { c: "d" }, e: ["f"], g: [{ g: "i" }], l: [Function l], m: [Getter], n: [Getter], o: [Function], p: [Function], q: 5, s: 29879287298374924, t: Set(3) { 1, 2, 3 }, u: Map(3) { 1 => 2, 3 => 4, [Function foo] => {} }, v: Symbol.for("blah"), w: Symbol(), x: undefined, y: null, z: null, zz: Uint8Array [1, 2, 3], zzz: Z {} }\n`);
  strictEqual(stdout, '');
}
