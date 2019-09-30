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
});
