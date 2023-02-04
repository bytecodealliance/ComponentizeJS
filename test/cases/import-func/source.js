import foo from 'foo';
import foo1 from 'foo1';
import foo2 from 'foo2';
import foo3 from 'foo3';

if (typeof foo !== 'function' || typeof foo1 !== 'function' || typeof foo2 !== 'function' || typeof foo3 !== 'function')
  throw new Error('Direct functions not defined');
