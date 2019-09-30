const utils = require('./lib/utils');

const DEFAULT_ERROR_NODE = {
  type: 'Identifier',
  name: 'error',
  optional: false,
  typeAnnotation: null
};

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
      if (!last || last.type !== 'ReturnStatement') {
        return false;
      }
      return utils.isPromiseCall(last.argument);
    }

    return utils.isPromiseCall(node.body);
  };

  const getRestFromCallBack = (p, callBack, lastExp, resultIdentifierName) => {
    let rest;
    if (!callBack.body) {
      const callBackCall = j.callStatement(callBack, [
        lastExp.argument.callee.property.name === 'spread'
          ? j.spreadElement(j.identifier(resultIdentifierName))
          : j.identifier(resultIdentifierName)
      ]);
      if (callBack.type === 'Identifier' && callBack.name === 'undefined') {
        // "return a().then(undefined)" becomes "await a()"
        rest = [];
      } else if (lastExp.type === 'ReturnStatement') {
        // "return promise.then(doSomething)" becomes "return doSomething(promiseResult)"
        rest = [j.returnStatement(callBackCall.expression)];
      } else {
        // "promise.then(doSomething)" becomes "doSomething(promiseResult)"
        rest = [callBackCall];
      }
    } else if (callBack.body.type === 'BlockStatement') {
      rest = callBack.body.body;
      utils.resolveNameConflicts(j, p, callBack.body);
    } else {
      rest = [j.returnStatement(callBack.body)];
    }
    return rest;
  };

  function getCalleeName(thenCalleeObject) {
    let currentNode = thenCalleeObject;
    while (currentNode && !currentNode.name) {
      if (currentNode.property && currentNode.property.type === 'Identifier') {
        currentNode = currentNode.property;
      } else {
        currentNode = currentNode.callee || currentNode.object;
      }
    }
    // if we failed to get a name from iterating on callee/property, fallback to using 'promise'
    return currentNode ? currentNode.name : 'promise';
  }

  const transformFunction = p => {
    const node = p.node;

    let bodyStatements;
    if (node.body.type === 'BlockStatement') {
      bodyStatements = node.body.body;
    } else {
      bodyStatements = [node.body];
    }

    if (!bodyStatements) {
      // eslint-disable-next-line no-console
      console.log('no body', node.type, node.loc);
      return;
    }
    // Transform return
    const lastExp = bodyStatements[bodyStatements.length - 1];

    // if lastExp is a return, use the argument
    const callExp = lastExp.expression || lastExp.argument || lastExp;
    if (!callExp) {
      // the lack of any statements in fulfilled handler is unusual but
      // might be intentional

      // eslint-disable-next-line no-console
      console.log('no return expression', node.type, lastExp.loc);
      return;
    }

    // Set function to async
    node.async = true;

    let {errorCallBack, callBack, thenCalleeObject} = utils.parseCallExpression(
      callExp
    );
    const calleeName = getCalleeName(thenCalleeObject);
    // TODO: we should ensure the generated resultIdentifierName is unique because it might conflict with the name of another identifier
    const resultIdentifierName = calleeName + 'Result';

    // Create await statement
    let awaition;
    if (callBack.params) {
      if (callBack.params.length > 0) {
        utils.resolveParamNameConflicts(j, p, callBack);
        awaition = utils.genAwaitionDeclarator(
          j,
          callExp,
          callBack,
          callBack.params,
          thenCalleeObject
        );
      } else {
        awaition = j.expressionStatement(j.awaitExpression(thenCalleeObject));
      }
    } else if (
      callBack.type === 'Identifier' &&
      callBack.name === 'undefined'
    ) {
      awaition = j.expressionStatement(j.awaitExpression(thenCalleeObject));
    } else {
      // no params (and no body), not an inline function, so we can't simply use the body of the callee (?)
      awaition = utils.genAwaitionDeclarator(
        j,
        callExp,
        callBack,
        [j.identifier(resultIdentifierName)],
        thenCalleeObject
      );
    }

    let leadingComments = awaition.leadingComments || [];
    if (callExp.leadingComments && callExp.leadingComments[0]) {
      // preserve any comments from the call expression
      leadingComments = callExp.leadingComments.concat(leadingComments);
    }
    if (
      callExp !== lastExp &&
      lastExp &&
      lastExp.leadingComments &&
      lastExp.leadingComments[0]
    ) {
      // preserve any comments from the last statement (generally the return expression)
      leadingComments = lastExp.leadingComments.concat(leadingComments);
    }
    awaition.comments = leadingComments;

    const rest = getRestFromCallBack(
      p,
      callBack,
      lastExp,
      resultIdentifierName
    );

    // Replace the function's body with the new content
    const tryStatements = [awaition, ...rest];

    const errorParam =
      errorCallBack &&
      ((errorCallBack.params && errorCallBack.params[0]) || DEFAULT_ERROR_NODE);
    p.node.body = j.blockStatement(
      errorCallBack
        ? [
            ...bodyStatements.slice(0, bodyStatements.length - 1),
            j.tryStatement(
              j.blockStatement(tryStatements),
              j.catchClause(
                errorParam,
                null,
                j.blockStatement(
                  getRestFromCallBack(
                    p,
                    errorCallBack,
                    lastExp,
                    errorParam.name
                  )
                )
              )
            )
          ]
        : [
            ...bodyStatements.slice(0, bodyStatements.length - 1),
            ...tryStatements
          ]
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

      somethingTransformed = false;
      paths.forEach(path => {
        if (transformFunction(path)) {
          somethingTransformed = true;
        }
      });
    } while (somethingTransformed && iterations < iterationsLimit);
  };

  replaceType(j.FunctionExpression);

  replaceType(j.FunctionDeclaration);

  replaceType(j.ArrowFunctionExpression, arrowReturnsPromise);

  // TODO: cover more async/await cases
  // TODO: cover .then().finally()

  return root.toSource();
};
