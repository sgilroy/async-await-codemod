const defineTest = require('jscodeshift/dist/testUtils').defineTest;
const defineInlineTest = require('jscodeshift/dist/testUtils').defineInlineTest;
const transform = require('../async-await');

function extractBody(f) {
  const lines = f
    .toString()
    // split into lines
    .split('\n')
    // remove extra indent
    .map(line => line.substring(2));

  // remove first and last lines (anonymous wrapper function)
  return lines.slice(1, lines.length - 1).join('\n');
}

function defineTestFromFunctions(input, output, name) {
  defineInlineTest(
    transform,
    {},
    extractBody(input),
    extractBody(output),
    name
  );
}

describe('async-await', () => {
  describe('fixtures', function() {
    defineTest(__dirname, 'async-await');
  });

  describe('simple then', function() {
    defineTestFromFunctions(
      () => {
        function a() {
          return b().then(c => {
            return c.d;
          });
        }
      },
      () => {
        async function a() {
          const c = await b();
          return c.d;
        }
      }
    );
  });

  describe('then with rejection handler', function() {
    defineTestFromFunctions(
      () => {
        function thenFulfilledRejected() {
          return b().then(
            c => {
              return c.d;
            },
            error => {
              console.error(error);
            }
          );
        }
      },
      () => {
        async function thenFulfilledRejected() {
          try {
            const c = await b();
            return c.d;
          } catch (error) {
            console.error(error);
          }
        }
      }
    );
  });
});
