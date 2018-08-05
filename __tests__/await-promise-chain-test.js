const defineTest = require('jscodeshift/dist/testUtils').defineTest;
describe('await-promise-chain', () => {
  defineTest(__dirname, 'await-promise-chain');
});
