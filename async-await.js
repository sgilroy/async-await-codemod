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
      if (!last || last.type !== 'ReturnStatement') {
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
        (statement.expression.callee.property.name === 'then' ||
          statement.expression.callee.property.name === 'spread')
      ) {
        // mark function as containing a Promise Expression
        return true;
      }
    }
  };

  const getRestFromCallBack = (callBack, lastExp, resultIdentifierName) => {
    let rest;
    if (!callBack.body) {
      const callBackCall = j.callStatement(callBack, [
        j.identifier(resultIdentifierName)
      ]);
      if (lastExp.type === 'ReturnStatement') {
        // "return promise.then(doSomething)" becomes "return doSomething(promiseResult)"
        rest = [j.returnStatement(callBackCall.expression)];
      } else {
        // "promise.then(doSomething)" becomes "doSomething(promiseResult)"
        rest = [callBackCall];
      }
    } else if (callBack.body.type === 'BlockStatement') {
      rest = callBack.body.body;
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

  /**
   * Recursively walks up the path to find the names of all declarations in scope
   * @param {Path} p
   * @param {Array<String>} [names]
   * @return {Array<String>}
   */
  function getNames(p, names = []) {
    if (p && p.value && p.value.body && p.value.body.body) {
      for (const node of p.value.body.body) {
        if (node.declarations) {
          for (const declaration of node.declarations) {
            if (declaration.id && declaration.id.name) {
              names.push(declaration.id.name);
            }
          }
        }
        if (node.id && node.id.name) {
          names.push(node.id.name);
        }
      }
    }

    if (p.parentPath) {
      return getNames(p.parentPath, names);
    } else {
      return names;
    }
  }

  const suffixLimit = 9;
  function getUniqueName(namesInScope, param) {
    let safeName,
      name = param.name;
    if (!name) {
      return;
    }
    let i = 1;
    do {
      if (!namesInScope.includes(name)) {
        safeName = name;
      } else {
        i++;
        name = param.name + i;
      }
    } while (!safeName && i < suffixLimit);

    return safeName;
  }

  function renameParam(p, parent, param, newName) {
    const rootScope = p.scope;
    const oldName = param.name;

    // rename usages of the param
    // this borrows heavily from the renameTo transform from VariableDeclarator in jscodeshift
    j(parent)
      .find(j.Identifier, {name: oldName})
      .filter(function(path) {
        // ignore non-variables
        const parent = path.parent.node;

        if (
          j.MemberExpression.check(parent) &&
          parent.property === path.node &&
          !parent.computed
        ) {
          // obj.oldName
          return false;
        }

        if (
          j.Property.check(parent) &&
          parent.key === path.node &&
          !parent.computed
        ) {
          // { oldName: 3 }
          return false;
        }

        if (
          j.MethodDefinition.check(parent) &&
          parent.key === path.node &&
          !parent.computed
        ) {
          // class A { oldName() {} }
          return false;
        }

        if (
          j.JSXAttribute.check(parent) &&
          parent.name === path.node &&
          !parent.computed
        ) {
          // <Foo oldName={oldName} />
          return false;
        }

        return true;
      })
      .forEach(function(path) {
        let scope = path.scope;
        while (scope && scope !== rootScope) {
          if (scope.declares(oldName)) {
            return;
          }
          scope = scope.parent;
        }

        // identifier must refer to declared variable
        // It may look like we filtered out properties,
        // but the filter only ignored property "keys", not "value"s
        // In shorthand properties, "key" and "value" both have an
        // Identifier with the same structure.
        const parent = path.parent.node;
        if (j.Property.check(parent) && parent.shorthand && !parent.method) {
          path.parent.get('shorthand').replace(false);
        }

        path.get('name').replace(newName);
      });

    // rename the param declaration
    param.name = newName;
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
        const namesInScope = getNames(p);
        for (const param of callBack.params) {
          const name = getUniqueName(namesInScope, param);
          if (name && name !== param.name) {
            renameParam(p, callBack.body, param, name);
          }
        }
        awaition = utils.genAwaitionDeclarator(
          j,
          callBack.params,
          thenCalleeObject
        );
      } else {
        awaition = j.expressionStatement(j.awaitExpression(thenCalleeObject));
      }
    } else {
      // no params (and no body), not an inline function, so we can't simply use the body of the callee (?)
      awaition = utils.genAwaitionDeclarator(
        j,
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

    const rest = getRestFromCallBack(callBack, lastExp, resultIdentifierName);

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
                errorCallBack.type === 'ArrowFunctionExpression' &&
                errorCallBack.body.type === 'CallExpression'
                  ? j.blockStatement([j.returnStatement(errorCallBack.body)])
                  : j.blockStatement(errorCallBack.body.body)
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
  replaceType(j.FunctionDeclaration, funcContainsPromiseExpressionStatement);

  replaceType(j.ArrowFunctionExpression, arrowReturnsPromise);

  replaceType(j.FunctionExpression, funcContainsPromiseExpressionStatement);
  replaceType(j.FunctionExpression);

  // TODO: cover more async/await cases
  // TODO: cover .then().finally()

  return root.toSource();
};
