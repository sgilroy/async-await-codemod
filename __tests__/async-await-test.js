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

  describe('await result should avoid param name conflict', function() {
    defineTestFromFunctions(
      () => {
        function paramNameConflict(category) {
          return category.get().then(function(category) {
            return category.name;
          });
        }
      },
      () => {
        async function paramNameConflict(category) {
          const category2 = await category.get();
          return category2.name;
        }
      }
    );
  });

  describe('await result should avoid unpacked param name conflict', function() {
    defineTestFromFunctions(
      () => {
        function paramNameConflict({category}) {
          return category.get().then(function(category) {
            return category.name;
          });
        }
      },
      () => {
        async function paramNameConflict({category}) {
          const category2 = await category.get();
          return category2.name;
        }
      }
    );
  });

  describe('await result should avoid unpacked nested param name conflict', function() {
    defineTestFromFunctions(
      () => {
        function paramNameConflict({results: {category}}) {
          return category.get().then(function(category) {
            return category.name;
          });
        }
      },
      () => {
        async function paramNameConflict({results: {category}}) {
          const category2 = await category.get();
          return category2.name;
        }
      }
    );
  });

  describe('await result should avoid unpacked nested renamed param name conflict', function() {
    defineTestFromFunctions(
      () => {
        function paramNameConflict({results: {original: category}}) {
          return category.get().then(function(category) {
            return category.name;
          });
        }
      },
      () => {
        async function paramNameConflict({results: {original: category}}) {
          const category2 = await category.get();
          return category2.name;
        }
      }
    );
  });

  describe('returned rejection handler as identifier', function() {
    defineTestFromFunctions(
      () => {
        function thenFulfilledRejected() {
          return b().then(c => {
            return c.d;
          }, callback);
        }
      },
      () => {
        async function thenFulfilledRejected() {
          try {
            const c = await b();
            return c.d;
          } catch (error) {
            return callback(error);
          }
        }
      }
    );
  });

  describe('non-returned rejection handler as identifier', function() {
    defineTestFromFunctions(
      () => {
        function thenFulfilledRejected() {
          b().then(c => {
            return c.d;
          }, callback);
        }
      },
      () => {
        async function thenFulfilledRejected() {
          try {
            const c = await b();
            return c.d;
          } catch (error) {
            callback(error);
          }
        }
      }
    );
  });
});
