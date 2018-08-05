const utils = require('./lib/utils');

module.exports = function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  const containsAwaitOnPromise = p => {
    for (let bodyStatement of p.node.body) {
      let awaitExpression;
      if (bodyStatement.type === 'AwaitExpression') {
        awaitExpression = bodyStatement;
        if (utils.isPromiseCall(awaitExpression.argument)) {
          return {bodyStatement, awaitExpression};
        }
      } else if (bodyStatement.type === 'VariableDeclaration') {
        for (let declarator of bodyStatement.declarations) {
          if (declarator.init && declarator.init.type === 'AwaitExpression') {
            if (utils.isPromiseCall(declarator.init.argument)) {
              return {
                bodyStatement,
                awaitExpression: declarator.init,
                declarator
              };
            }
          }
        }
      }
    }
  };

  const transformExpression = p => {
    const node = p.node;

    const blockStatement = node;

    // find the body statement and await in this block
    const {bodyStatement, awaitExpression, declarator} = containsAwaitOnPromise(
      p
    );
    const expressionIndex = blockStatement.body.indexOf(bodyStatement);

    const callExp = awaitExpression.argument;
    if (!callExp) {
      console.log('no argument', node.type, node.loc);
      return;
    }

    // insert a new await prior to this await expression using the callee object of the existing await expression
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

    // Create await statement
    let firstAwaition;
    if (callBack.params.length > 0) {
      firstAwaition = utils.genAwaitionDeclarator(
        j,
        callBack.params,
        awaitExpression.argument.callee.object
      );
    } else {
      firstAwaition = j.expressionStatement(
        j.awaitExpression(awaitExpression.argument.callee.object)
      );
    }

    let callbackStatements;
    if (callBack.body.type === 'BlockStatement') {
      callbackStatements = callBack.body.body;
      firstAwaition.comments = bodyStatement.comments;
      bodyStatement.comments = callbackStatements[callbackStatements.length - 1].comments;
    } else {
      callbackStatements = [j.returnStatement(callBack.body)];
    }

    // Transform return of callback
    const lastExp = callbackStatements[callbackStatements.length - 1];
    // if lastExp is a return, use the argument
    const lastExpArgument = lastExp.expression || lastExp.argument || lastExp;
    if (!lastExpArgument) {
      console.log('no return expression', node.type, lastExp.loc);
      return;
    }

    // transform the existing await expression using the return of the then callback
    awaitExpression.argument = lastExpArgument;
    // if (declarator) {
    //   secondAwaition = genAwaitionDeclarator(callBack.params, thenCalleeObject);
    // } else {
    //   secondAwaition = j.expressionStatement(
    //     j.awaitExpression(thenCalleeObject)
    //   );
    // }
    // secondAwaition = bodyStatement;

    let bodyStatements = blockStatement.body;
    if (!bodyStatements) {
      console.log('no body', node.type, node.loc);
      return;
    }
    const prior = bodyStatements.slice(0, expressionIndex);
    const rest = bodyStatements.slice(expressionIndex + 1);
    blockStatement.body = [
      ...prior,
      firstAwaition,
      ...callbackStatements.slice(0, callbackStatements.length - 1),
      bodyStatement,
      ...rest
    ];

    return true;
  };

  const replaceType = (type, filterer = containsAwaitOnPromise) => {
    // Loop until all promises are gone or no transforms are possible
    let somethingTransformed = false;
    let iterations = 0;
    const iterationsLimit = 256;
    do {
      iterations++;
      const paths = root.find(type).filter(filterer);
      if (paths.size() === 0) {
        break;
      }

      paths.forEach(path => {
        if (transformExpression(path)) {
          somethingTransformed = true;
        }
      });
    } while (somethingTransformed && iterations < iterationsLimit);
  };

  // replaceType(j.AwaitExpression);
  // replaceType(j.VariableDeclarator);
  replaceType(j.BlockStatement);

  // TODO: cover .then().then() chains
  /*

  function thenChain() {
    return b().then(c => {
      return c.d();
    }).then(e => {
      return 'end with ' + e;
    });
  }

  to

  async function thenChain() {
    const c = await b();
    const e = await c.d();
    return 'end with ' + e;
  }

  */
  // TODO: also check for callee chain with eventual .then()
  /*
  function chainEventualThen() {
    return Model.find().exec().then(items => {
      return items.map(item => item.thing);
    });
  }
   */

  // TODO: allow opt-out of chained promise unravelling, which risks such as masking a global via local variable
  // TODO: avoid changing behavoir by unravelling a then callback with a conditional return

  return root.toSource();
};
