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
      z: new URL('https://site.com/x?a&b'),
      zz: new Uint8Array([1,2,3]),
      zzz: new Z()
    };
    Object.defineProperty(o, 'hidden', { value: 'hidden', enumerable: false });
    console.log(o);
  };
  export function ready () {
    return true;
  }
`;

export async function test (run) {
  const { stdout, stderr } = await run();
  strictEqual(stdout, `{ a: { value: "a" }, b: { c: "d" }, e: ["f"], g: [{ g: "i" }], l: [ l () {
  
      }], m: [Getter], n: [Getter], o: [ function () {
  
      }], p: [ () => {}], q: 5, s: 29879287298374924, t: Set(3) { 1, 2, 3 }, u: Map(3) { 1 => 2, 3 => 4, [ function foo () {}] => {} }, v: Symbol.for("blah"), w: Symbol(), x: undefined, y: null, z: URL { hash: "", host: "site.com", hostname: "site.com", href: "https://site.com/x?a&b", origin: "https://site.com", password: "", pathname: "/x", port: "", protocol: "https:", search: "?a&b", searchParams: URLSearchParams {}, username: "" }, zz: Uint8Array [1, 2, 3], zzz: Z {} }\n`);
  strictEqual(stderr, '');
}
