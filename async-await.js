const utils = require('./lib/utils');

module.exports = function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  const funcReturnsPromise = p => {
    const body = p.node.body.body;
    const last = body[body.length - 1];
    if (!last || last.type !== 'ReturnStatement') {
      return false;
    }
    return utils.isPromiseCall(last.argument);
  };

  const arrowReturnsPromise = p => {
    const node = p.node;

    if (node.body.type === 'BlockStatement') {
      const body = node.body.body;
      const last = body[body.length - 1];
      if (last.type !== 'ReturnStatement') {
        return false;
      }
      return utils.isPromiseCall(last.argument);
    }

    return utils.isPromiseCall(node.body);
  };

  const funcContainsPromiseExpressionStatement = p => {
    const fnStatementsArray = p.node.body.body;

    for (let i = 0; i <= fnStatementsArray.length; i++) {
      const statement = fnStatementsArray[i];

      if (
        statement &&
        statement.expression &&
        statement.expression.type === 'CallExpression' &&
        statement.expression.callee.property &&
        statement.expression.callee.property.name === 'then'
      ) {
        // mark function as containing a Promise Expression
        return true;
      }
    }
  };

  const transformFunction = p => {
    const node = p.node;

    let bodyStatements;
    if (node.body.type === 'BlockStatement') {
      bodyStatements = node.body.body;
    } else {
      bodyStatements = [node.body];
    }

    if (!bodyStatements) {
      console.log('no body', node.type, node.loc);
      return;
    }
    // Transform return
    const lastExp = bodyStatements[bodyStatements.length - 1];

    // if lastExp is a return, use the argument
    const callExp = lastExp.expression || lastExp.argument || lastExp;
    if (!callExp) {
      console.log('no return expression', node.type, lastExp.loc);
      return;
    }

    // Set function to async
    node.async = true;

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
    let awaition;
    if (callBack.params && callBack.params.length > 0) {
      awaition = utils.genAwaitionDeclarator(j, callBack.params, thenCalleeObject);
    } else {
      awaition = j.expressionStatement(j.awaitExpression(thenCalleeObject));
    }

    let rest;
    if (callBack.body.type === 'BlockStatement') {
      rest = callBack.body.body;
    } else {
      rest = [j.returnStatement(callBack.body)];
    }

    // Replace the function's body with the new content
    const tryStatements = [
      ...bodyStatements.slice(0, bodyStatements.length - 1),
      awaition,
      ...rest
    ];
    p.node.body = j.blockStatement(
      errorCallBack
        ? [
            j.tryStatement(
              j.blockStatement(tryStatements),
              j.catchClause(
                errorCallBack.params[0],
                null,
                j.blockStatement(errorCallBack.body.body)
              )
            )
          ]
        : tryStatements
    );

    return p.node;
  };

  const replaceType = (type, filterer = funcReturnsPromise) => {
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
        if (transformFunction(path)) {
          somethingTransformed = true;
        }
      });
    } while (somethingTransformed && iterations < iterationsLimit);
  };

  replaceType(j.FunctionDeclaration);
  replaceType(j.ArrowFunctionExpression, arrowReturnsPromise);

  replaceType(j.FunctionExpression, funcContainsPromiseExpressionStatement);
  replaceType(j.FunctionExpression);

  // TODO: cover more async/await cases
  // TODO: cover .then().finally()

  return root.toSource();
};
