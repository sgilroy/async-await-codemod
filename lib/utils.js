'use strict';

function recursiveGetObjectPatternNames(node, names) {
  if (node.type === 'Identifier' && node.name) {
    names.push(node.name);
  } else if (node.type === 'ObjectPattern') {
    // recurse through the object pattern
    for (const property of node.properties) {
      if (property && property.key && property.key.type === 'Identifier') {
        if (property.value && property.value.type === 'Identifier') {
          names.push(property.value.name);
        } else if (property.value && property.value.type === 'ObjectPattern') {
          recursiveGetObjectPatternNames(property.value, names);
          names.push(property.key.name);
        }
      }
    }
  }
}

/**
 * Recursively walks up the path to find the names of all declarations in scope
 * @param {Path} p
 * @param {Array<String>} [names]
 * @return {Array<String>}
 */
function getNames(p, names = []) {
  if (p && p.value) {
    if (p.value.body && Array.isArray(p.value.body.body)) {
      for (const node of p.value.body.body) {
        if (node.declarations) {
          for (const declaration of node.declarations) {
            if (declaration.id) {
              if (declaration.id.type === 'ArrayPattern') {
                for (const element of declaration.id.elements) {
                  names.push(element.name);
                }
              } else if (declaration.id.name) {
                names.push(declaration.id.name);
              }
            }
          }
        }
        if (node.id && node.id.name) {
          names.push(node.id.name);
        }
      }
    }

    if (p.value.params) {
      for (const param of p.value.params) {
        recursiveGetObjectPatternNames(param, names);
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

function renameElement(j, p, parent, element, namesInScope) {
  const newName = getUniqueName(namesInScope, element);
  if (!newName || newName === element.name) {
    // no safe name or name already unique
    return;
  }

  const rootScope = p.scope;
  const oldName = element.name;

  // rename usages of the element
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

  // rename the element declaration
  element.name = newName;
}

module.exports = {
  isPromiseCall: node => {
    return (
      node &&
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
    if (callExp.callee.property && callExp.callee.property.name === 'catch') {
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
  },

  /**
   * Resolves any name conflicts (renames the params) that would arise in path p from adding
   * variables based on the params of the callBack
   * @param j jscodeshift API facade
   * @param {Path} p The parent path
   * @param {Node} callBack
   */
  resolveParamNameConflicts: (j, p, callBack) => {
    const namesInScope = getNames(p);
    for (const param of callBack.params) {
      if (param.type === 'ArrayPattern') {
        for (const element of param.elements) {
          if (element) {
            renameElement(j, p, callBack.body, element, namesInScope);
          }
        }
      } else {
        renameElement(j, p, callBack.body, param, namesInScope);
      }
    }
  },

  /**
   * Renames any variable declarations or functions in body that would conflict with any names in path p
   * @param j jscodeshift API facade
   * @param {Path} p The parent path
   * @param {Body} body
   */
  resolveNameConflicts: (j, p, body) => {
    const namesInScope = getNames(p);
    for (const node of body.body) {
      if (node.declarations) {
        for (const declaration of node.declarations) {
          if (declaration.id) {
            if (declaration.id.type === 'ArrayPattern') {
              for (const element of declaration.id.elements) {
                renameElement(j, p, body, element, namesInScope);
              }
            } else if (declaration.id.name) {
              renameElement(j, p, body, declaration.id, namesInScope);
            }
          }
        }
      }
      if (node.id && node.id.name) {
        renameElement(j, p, body, node.id, namesInScope);
      }
    }
  }
};
