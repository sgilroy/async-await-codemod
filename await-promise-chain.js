const utils = require('./lib/utils');

module.exports = function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  /**
   * Looks at each body statement of the node and returns the body statement and
   * inner await expression if the await is on a nested promise with a .then callback
   * @param p The path to check
   * @return {{awaitExpression: StatementTypes.expression, bodyStatement}}
   */
  const containsAwaitOnPromise = p => {
    for (let bodyStatement of p.node.body) {
      let awaitExpression;
      if (
        bodyStatement.type === 'ReturnStatement' &&
        bodyStatement.argument &&
        bodyStatement.argument.type === 'AwaitExpression'
      ) {
        awaitExpression = bodyStatement.argument;
        if (utils.isPromiseCall(awaitExpression.argument)) {
          return {bodyStatement, awaitExpression};
        }
      } else if (
        bodyStatement.type === 'ExpressionStatement' &&
        bodyStatement.expression.type === 'AwaitExpression'
      ) {
        awaitExpression = bodyStatement.expression;
        if (utils.isPromiseCall(awaitExpression.argument)) {
          return {bodyStatement, awaitExpression};
        }
      } else if (bodyStatement.type === 'AwaitExpression') {
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
    let {errorCallBack, callBack, thenCalleeObject} = utils.parseCallExpression(
      callExp
    );

    // Create await statement
    let firstAwaition;
    if (callBack.params && callBack.params.length > 0) {
      utils.resolveParamNameConflicts(j, p, callBack);
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
    if (callBack.body && callBack.body.type === 'BlockStatement') {
      callbackStatements = callBack.body.body;
      firstAwaition.comments = bodyStatement.comments;
      if (callbackStatements.length > 0) {
        bodyStatement.comments =
          callbackStatements[callbackStatements.length - 1].comments;
      }
    } else if (callBack.body) {
      callbackStatements = [j.returnStatement(callBack.body)];
    } else {
      // eslint-disable-next-line no-console
      console.log('no callBack.body at', callBack.loc.start);
      return;
    }

    // Transform return of callback
    const lastExp = callbackStatements[callbackStatements.length - 1];
    // if lastExp is a return, use the argument
    const returnLast = lastExp && lastExp.type === 'ReturnStatement';

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
      ...(returnLast
        ? callbackStatements.slice(0, callbackStatements.length - 1)
        : callbackStatements)
    ];
    if (returnLast || bodyStatement.type !== 'ReturnStatement') {
      const lastExpArgument =
        lastExp && (lastExp.expression || lastExp.argument || lastExp);
      if (!lastExpArgument) {
        // example: const p = await b().then(() => {})
        // eslint-disable-next-line no-console
        console.log(
          'no return expression',
          node.type,
          lastExp ? lastExp.loc.start : callBack.loc.start
        );
        return;
      }

      // transform the existing await expression using the return of the then callback
      awaitExpression.argument = lastExpArgument;
      tryStatements.push(bodyStatement);
    }
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

      somethingTransformed = false;
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
