const defineTest = require('jscodeshift/dist/testUtils').defineTest;
const {defineTransformTestFromFunctions} = require('../lib/test-utils');
const transform = require('../await-promise-chain');

function defineTestFromFunctions(input, output, name) {
  defineTransformTestFromFunctions(transform, input, output, name);
}

describe('await-promise-chain', () => {
  describe('fixtures', function() {
    defineTest(__dirname, 'await-promise-chain');
  });

  describe('simple chain', function() {
    defineTestFromFunctions(
      () => {
        async function thenChain() {
          console.log('before');

          const e = await b().then(c => {
            return c.d();
          });

          return 'end with ' + e;
        }
      },
      () => {
        async function thenChain() {
          console.log('before');

          const c = await b();

          const e = await c.d();

          return 'end with ' + e;
        }
      }
    );
  });

  describe('return assignment chained', function() {
    defineTestFromFunctions(
      () => {
        async function returnAssignmentChained() {
          await b().then(p => (this.c = p.c));
          return d(this.c);
        }
      },
      () => {
        async function returnAssignmentChained() {
          const p = await b();
          this.c = p.c;
          return d(this.c);
        }
      }
    );
  });

  describe.skip('transform variable declaration with conditional return', function() {
    defineTestFromFunctions(
      () => {
        async function thenChain() {
          console.log('before');

          const e = await b().then(c => {
            if (c) {
              return c.d();
            }
          });

          return 'end with ' + e;
        }
      },
      () => {
        async function thenChain() {
          console.log('before');

          const c = await b();

          let e;
          if (c) {
            e = await c.d();
          }

          return 'end with ' + e;
        }
      }
    );
  });

  describe('should not transform variable declaration with conditional return', function() {
    defineTestFromFunctions(
      () => {
        async function thenChain() {
          console.log('before');

          const e = await b().then(c => {
            if (c) {
              return c.d();
            }
          });

          return 'end with ' + e;
        }
      },
      () => {
        async function thenChain() {
          console.log('before');

          const e = await b().then(c => {
            if (c) {
              return c.d();
            }
          });

          return 'end with ' + e;
        }
      }
    );
  });
});
