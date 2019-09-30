const defineInlineTest = require('jscodeshift/dist/testUtils').defineInlineTest;

function extractBody(f) {
  if (typeof f === 'string') {
    return f;
  }

  const lines = f
    .toString()
    // split into lines
    .split('\n')
    // remove extra indent
    .map(line => line.substring(2));

  // remove first and last lines (anonymous wrapper function)
  return lines.slice(1, lines.length - 1).join('\n');
}

function defineTransformTestFromFunctions(transform, input, output, name) {
  defineInlineTest(
    transform,
    {},
    extractBody(input),
    extractBody(output),
    name
  );
}

module.exports = {
  defineTransformTestFromFunctions
};
