'use strict';

module.exports = {
  isPromiseCall: node => {
    return (
      node.type === 'CallExpression' &&
      node.callee.property &&
      (node.callee.property.name === 'then' ||
        (node.callee.property.name === 'catch' &&
          node.callee.object &&
          node.callee.object.type === 'CallExpression' &&
          node.callee.object.callee.property &&
          node.callee.object.callee.property.name === 'then'))
    );
  },

  genAwaitionDeclarator: (j, params, exp) => {
    let declaratorId;
    if (params.length > 1) {
      declaratorId = j.arrayPattern(params);
    } else {
      declaratorId = params[0];
    }

    return j.variableDeclaration('const', [
      j.variableDeclarator(declaratorId, j.awaitExpression(exp))
    ]);
  }
};
