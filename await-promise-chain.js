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
                awaitExpression: declarator.init
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
    const {bodyStatement, awaitExpression} = containsAwaitOnPromise(p);
    const expressionIndex = blockStatement.body.indexOf(bodyStatement);

    const callExp = awaitExpression.argument;
    if (!callExp) {
      // eslint-disable-next-line no-console
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
        thenCalleeObject
      );
    } else {
      firstAwaition = j.expressionStatement(
        j.awaitExpression(thenCalleeObject)
      );
    }

    let callbackStatements;
    if (callBack.body.type === 'BlockStatement') {
      callbackStatements = callBack.body.body;
      firstAwaition.comments = bodyStatement.comments;
      bodyStatement.comments =
        callbackStatements[callbackStatements.length - 1].comments;
    } else {
      callbackStatements = [j.returnStatement(callBack.body)];
    }

    // Transform return of callback
    const lastExp = callbackStatements[callbackStatements.length - 1];
    // if lastExp is a return, use the argument
    const lastExpArgument = lastExp.expression || lastExp.argument || lastExp;
    if (!lastExpArgument) {
      // eslint-disable-next-line no-console
      console.log('no return expression', node.type, lastExp.loc);
      return;
    }

    // transform the existing await expression using the return of the then callback
    awaitExpression.argument = lastExpArgument;

    let bodyStatements = blockStatement.body;
    if (!bodyStatements) {
      // eslint-disable-next-line no-console
      console.log('no body', node.type, node.loc);
      return;
    }
    const prior = bodyStatements.slice(0, expressionIndex);
    const rest = bodyStatements.slice(expressionIndex + 1);
    const tryStatements = [
      firstAwaition,
      ...callbackStatements.slice(0, callbackStatements.length - 1),
      bodyStatement
    ];
    blockStatement.body = errorCallBack
      ? [
          ...prior,
          j.tryStatement(
            j.blockStatement(tryStatements),
            j.catchClause(
              errorCallBack.params[0],
              null,
              j.blockStatement(errorCallBack.body.body)
            )
          ),
          ...rest
        ]
      : [...prior, ...tryStatements, ...rest];

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

  // TODO: handle catch and finally blocks when unravelling
  // TODO: avoid changing behavior by unravelling a then callback with a conditional return
  // TODO: avoid changing behavior by unravelling a then with a parameter or local variable which masks a variable in an unravelled block

  return root.toSource();
};
