'use strict';

module.exports = {
  isPromiseCall: node => {
    return (
      node.type === 'CallExpression' &&
      node.callee.property &&
      (node.callee.property.name === 'then' ||
        node.callee.property.name === 'spread' ||
        (node.callee.property.name === 'catch' &&
          node.callee.object &&
          node.callee.object.type === 'CallExpression' &&
          node.callee.object.callee.property &&
          (node.callee.object.callee.property.name === 'then' ||
            node.callee.object.callee.property.name === 'spread')))
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
  },

  /**
   * Determine the appropriate callbacks from the .catch or .then arguments of the call expression.
   * @param {Node} callExp
   * @return {{errorCallBack: Node, callBack: Node, thenCalleeObject: Node}}
   */
  parseCallExpression: callExp => {
    let errorCallBack, callBack;
    let thenCalleeObject;
    if (callExp.callee.property.name === 'catch') {
      errorCallBack = callExp.arguments[0];
      callBack = callExp.callee.object.arguments[0];
      thenCalleeObject = callExp.callee.object.callee.object;
    } else {
      callBack = callExp.arguments[0];
      thenCalleeObject = callExp.callee.object;

      if (callExp.arguments[1]) {
        errorCallBack = callExp.arguments[1];
      }
    }
    return {errorCallBack, callBack, thenCalleeObject};
  }
};
