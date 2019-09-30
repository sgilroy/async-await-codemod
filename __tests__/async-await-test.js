const defineTest = require('jscodeshift/dist/testUtils').defineTest;
const {defineTransformTestFromFunctions} = require('../lib/test-utils');
const transform = require('../async-await');

function defineTestFromFunctions(input, output, name) {
  defineTransformTestFromFunctions(transform, input, output, name);
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

  describe('then not returned should not transform', function() {
    // transforming to async/await would change the behavior of the function
    defineTestFromFunctions(
      () => {
        function a() {
          b().then(c => {
            return c.d;
          });
        }
      },
      () => {
        function a() {
          b().then(c => {
            return c.d;
          });
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

  describe('await result should avoid variable name conflict', function() {
    defineTestFromFunctions(
      () => {
        function paramNameConflict() {
          const category = new Category();
          return category.get().then(function(category) {
            return category.name;
          });
        }
      },
      () => {
        async function paramNameConflict() {
          const category = new Category();
          const category2 = await category.get();
          return category2.name;
        }
      }
    );
  });

  describe('await result should avoid variable name conflict inside an anonymous function', function() {
    defineTestFromFunctions(
      () => {
        it('test', function a() {
          const category = new Category();
          return category.get().then(function(category) {
            return category.name;
          });
        });
      },
      () => {
        it('test', async function a() {
          const category = new Category();
          const category2 = await category.get();
          return category2.name;
        });
      }
    );
  });

  describe('await result should avoid variable name conflict for an arrow function inside an anonymous function', function() {
    defineTestFromFunctions(
      `
        it('test', function() {
          const plan = new Plan();
          return plan.save().then(() => {
            return Factory.create('plan');
          })
          .then(plan => {
            return Plan.update().then(() => {
              return Plan.findById(plan).exec();
            })
            .then(plan => {
              expect(plan.adherence_updated_at).to.equalTime(new Date());
            });
          });
        });
      `,
      `
        it('test', async function() {
          const plan = new Plan();

          const plan2 = await plan.save().then(() => {
            return Factory.create('plan');
          });

          const plan3 = await Plan.update().then(() => {
            return Plan.findById(plan2).exec();
          });

          expect(plan3.adherence_updated_at).to.equalTime(new Date());
        });
      `
    );
  });

  // not supported yet
  describe.skip('await result should avoid variable name conflict for an anonymous function inside an arrow function', function() {
    defineTestFromFunctions(
      () => {
        it('test', () => {
          const plan = new Plan();
          return plan
            .save()
            .then(() => {
              return Factory.create('plan');
            })
            .then(function(plan) {
              return Plan.update()
                .then(() => {
                  return Plan.findById(plan).exec();
                })
                .then(function(plan) {
                  expect(plan.adherence_updated_at).to.equalTime(new Date());
                });
            });
        });
      },
      () => {
        it('test', async () => {
          const plan = new Plan();

          const plan2 = await plan.save().then(() => {
            return Factory.create('plan');
          });

          const plan3 = await Plan.update().then(() => {
            return Plan.findById(plan2).exec();
          });

          expect(plan3.adherence_updated_at).to.equalTime(new Date());
        });
      }
    );
  });

  describe('await result from an array destructured param should avoid conflict', function() {
    defineTestFromFunctions(
      () => {
        function a() {
          const entry = getEntries();
          return b(entry).then(([entry]) => {
            return c.d(entry);
          });
        }
      },
      () => {
        async function a() {
          const entry = getEntries();
          const [entry2] = await b(entry);
          return c.d(entry2);
        }
      }
    );
  });

  describe('await result from an array destructured param should avoid another destructured conflict', function() {
    defineTestFromFunctions(
      () => {
        function a() {
          return getEntries().then(([entry]) => {
            return b(entry).then(([entry]) => {
              return c.d(entry);
            });
          });
        }
      },
      () => {
        async function a() {
          const [entry] = await getEntries();
          const [entry2] = await b(entry);
          return c.d(entry2);
        }
      }
    );
  });

  describe('await result should avoid unpacked param name conflict', function() {
    defineTestFromFunctions(
      `
        function paramNameConflict({category}) {
          return category.get().then(function(category) {
            return category.name;
          });
        }
      `,
      `
        async function paramNameConflict({category}) {
          const category2 = await category.get();
          return category2.name;
        }
      `
    );
  });

  describe('await result should avoid unpacked nested param name conflict', function() {
    defineTestFromFunctions(
      `
        function paramNameConflict({results: {category}}) {
          return category.get().then(function(category) {
            return category.name;
          });
        }
      `,
      `
        async function paramNameConflict({results: {category}}) {
          const category2 = await category.get();
          return category2.name;
        }
      `
    );
  });

  describe('await result should avoid unpacked nested renamed param name conflict', function() {
    defineTestFromFunctions(
      `
        function paramNameConflict({results: {original: category}}) {
          return category.get().then(function(category) {
            return category.name;
          });
        }
      `,
      `
        async function paramNameConflict({results: {original: category}}) {
          const category2 = await category.get();
          return category2.name;
        }
      `
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

  describe('block statements before try', function() {
    defineTestFromFunctions(
      () => {
        function blockBefore() {
          const pre = 1;
          return a().then(something, callback);
        }
      },
      () => {
        async function blockBefore() {
          const pre = 1;

          try {
            const aResult = await a();
            return something(aResult);
          } catch (error) {
            return callback(error);
          }
        }
      }
    );
  });

  describe('non-returned rejection handler should not transform', function() {
    defineTestFromFunctions(
      () => {
        function thenFulfilledRejected() {
          b().then(c => {
            return c.d;
          }, callback);
        }
      },
      () => {
        function thenFulfilledRejected() {
          b().then(c => {
            return c.d;
          }, callback);
        }
      }
    );
  });

  describe('two unchained promises', function() {
    defineTestFromFunctions(
      () => {
        class TwoPromises {
          a() {
            b().then(() => f(1));
            c().then(() => f(2));
          }
        }
      },
      () => {
        class TwoPromises {
          a() {
            b().then(() => f(1));
            c().then(() => f(2));
          }
        }
      }
    );
  });

  describe('an unchained followed by a chained promise', function() {
    defineTestFromFunctions(
      () => {
        class TwoPromises {
          a() {
            b().then(() => f(1));
            return c().then(() => f(2));
          }
        }
      },
      () => {
        class TwoPromises {
          async a() {
            b().then(() => f(1));
            await c();
            return f(2);
          }
        }
      }
    );
  });

  describe('statement after then', function() {
    defineTestFromFunctions(
      () => {
        function a() {
          b().then(() => f(1));
          return f(2);
        }
      },
      () => {
        function a() {
          b().then(() => f(1));
          return f(2);
        }
      }
    );
  });

  describe('no return expression', function() {
    defineTestFromFunctions(
      () => {
        function countUserVotes(userIds) {
          return getUsers(userIds).then(users => {
            return Promise.reduce(users, (acc, user) => {
              return user.getVoteCount().then(count => acc + count);
            });
          });
        }
      },
      () => {
        async function countUserVotes(userIds) {
          const users = await getUsers(userIds);
          return Promise.reduce(users, async (acc, user) => {
            const count = await user.getVoteCount();
            return acc + count;
          });
        }
      }
    );
  });

  describe('return undefined chained', function() {
    defineTestFromFunctions(
      () => {
        function returnUndefinedChained() {
          return b()
            .then(() => {})
            .then(undefinedParam => {
              return c(undefinedParam);
            });
        }
      },
      () => {
        async function returnUndefinedChained() {
          const undefinedParam = await b().then(() => {});
          return c(undefinedParam);
        }
      }
    );
  });

  describe('then with shadow variable declaration', function() {
    defineTestFromFunctions(
      () => {
        function a() {
          const entry = 1;
          return b(entry).then(c => {
            const entry = 2;
            return c.d(entry);
          });
        }
      },
      () => {
        async function a() {
          const entry = 1;
          const c = await b(entry);
          const entry2 = 2;
          return c.d(entry2);
        }
      }
    );
  });

  describe('then with shadow variable declaration and conflict for rename', function() {
    defineTestFromFunctions(
      () => {
        function a() {
          const entry = 1,
            entry2 = 1.2;
          return b(entry, entry2).then(c => {
            const entry = 2;
            return c.d(entry);
          });
        }
      },
      () => {
        async function a() {
          const entry = 1,
            entry2 = 1.2;
          const c = await b(entry, entry2);
          const entry3 = 2;
          return c.d(entry3);
        }
      }
    );
  });

  describe('then with shadow function declaration', function() {
    defineTestFromFunctions(
      `
        function a() {
          function getEntry() {
            return 1;
          }
          return b(getEntry()).then(c => {
            function getEntry() {
              return 2;
            }
            return c.d(getEntry());
          });
        }
      `,
      `
        async function a() {
          function getEntry() {
            return 1;
          }
          const c = await b(getEntry());
          function getEntry2() {
            return 2;
          }
          return c.d(getEntry2());
        }
      `
    );
  });

  describe('rejection handler defined but fulfilled handler undefined', function() {
    defineTestFromFunctions(
      () => {
        function undefinedFulfilled() {
          return a().then(undefined, callback);
        }
      },
      () => {
        async function undefinedFulfilled() {
          try {
            await a();
          } catch (error) {
            return callback(error);
          }
        }
      }
    );
  });

  describe('spread to fulfilled handler that is an arrow function', function() {
    defineTestFromFunctions(
      () => {
        function spread() {
          return b().spread((c, d) => {
            return c(d).e;
          });
        }
      },
      () => {
        async function spread() {
          const [c, d] = await b();
          return c(d).e;
        }
      }
    );
  });

  describe('spread of single param to fulfilled handler that is an arrow function', function() {
    defineTestFromFunctions(
      () => {
        function spread() {
          return b().spread(c => {
            return c().d;
          });
        }
      },
      () => {
        async function spread() {
          const [c] = await b();
          return c().d;
        }
      }
    );
  });

  describe('spread to fulfilled handler that is an identifier', function() {
    defineTestFromFunctions(
      () => {
        function spread() {
          return b().spread(doSomething);
        }
      },
      () => {
        async function spread() {
          const bResult = await b();
          return doSomething(...bResult);
        }
      }
    );
  });
});
