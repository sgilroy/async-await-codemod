const defineTest = require('jscodeshift/dist/testUtils').defineTest;
describe('async-await', () => {
  defineTest(__dirname, 'async-await');
});
