function a() {
  return b().then(c => {
    return c.d;
  });
}

function thenFulfilledRejected() {
  return b().then(c => {
    return c.d;
  }, error => {
    console.error(error);
  });
}

function thenDotCatch() {
  return b().then(c => {
    return c.d;
  }).catch(error => {
    console.error(error);
  });
}

function embedded() {
  return first().then(() => {
    return second().then(() => {
      return third();
    });
  });
}

function promiseArrowShorthand() {
  return asyncFunc().then(result => ({ result }));
}

const functionExpression = function() {
  return asyncFunc().then(result => result * 2);
};

const functionExpressionCatch = function() {
  return asyncFunc().then(result => result * 2, error => console.error(error));
};

function countUserVotes(userIds) {
  return getUsers(userIds).then(users => {
    return Promise.reduce(users, (acc, user) => {
      return user.getVoteCount().then(count => acc + count);
    });
  });
}

function destructure(key) {
  return asyncFunc().then(({ [key]: result }) => {
    return result * 3;
  });
}

const makeRequestFunction = function() {
  return getJSON()
    .then(data => {
      console.log(data);
      return "done";
    });
};

const makeRequestArrowLong = () => {
  return getJSON()
    .then(data => {
      console.log(data);
      return "done";
    });
};

const makeRequest = () =>
  getJSON()
    .then(data => {
      console.log(data);
      return "done";
    });

function chainEventualThen() {
  return Model.find().exec().then(items => {
    return items.map(item => item.thing);
  });
}

app.get("/with-return", function(req, res) {
  return requestPromise(generateBeefFreeRecipeURL()).then(function(recipeResponse) {
    const recipesList = JSON.parse(recipeResponse).results;
    const recipe = recipesList[0];
    const responseText = `<pre>${
      cowsay.say({
        text: recipe.title
      })
    }</pre>`;

    res.send(responseText);
  }, function(error) {
    console.log(error);
  });
});

app.get("/without-return", function(req, res) {
  requestPromise(generateBeefFreeRecipeURL()).then(function(recipeResponse) {
    const recipesList = JSON.parse(recipeResponse).results;
    const recipe = recipesList[0];
    const responseText = `<pre>${
      cowsay.say({
        text: recipe.title
      })
    }</pre>`;

    res.send(responseText);
  }, function(error) {
    console.log(error);
  });
});

function blurImageData(imageData, radius) {
  const { height, width } = imageData;

  // comment before return
  return (
    // within return expression
    Promise.resolve(imageData.data.buffer.slice(0))
      // part of the resolve
      .then(bufferCopy => makeTransferable(bufferCopy))
      // chain
      .then(transferable => promiseBlur(transferable, width, height, radius))
      // more chaining comments
      .then(newBuffer => new Uint8ClampedArray(newBuffer))
      .then(pixels => imageData.data.set(pixels))
      .then(() => imageData)
  );
}

function arrayDestructuring() {
  return b().then(([, destructuredArrayElement]) => {
    return destructuredArrayElement.d;
  });
}

function doesSomethingWithAPromise() {
  promise.then(doSomething);
}

function returnsSomethingDone() {
  return promise.then(doSomething);
}

function returnsSomethingDone2(options) {
  return promise.then(options.doSomething);
}

function returnsSomethingDone3(options) {
  return getPromise(options).then(options.doSomething);
}

function returnsCallbackResult(options) {
  return start().getPromise(options).then(getCallback());
}

function returnsArrayCallbackResult(options) {
  return start().getPromise[1](options)[2].then(getCallback());
}

function returnsMultipleParams() {
  return b().then((x, y) => {
    return x.foo + y.foo;
  });
}

const emptyArrow = () => {};

function returnUndefined() {
  return b().then(() => {});
}

function returnUndefinedChained() {
  return b().then(() => {}).then(undefinedParam => {
    return c(undefinedParam);
  });
}

function spread() {
  return b().spread((c, d) => {
    return c(d).e;
  });
}

function conflictingVariableName() {
  const c = 'first';
  return b().then(c => {
    return c.d;
  });
}

function conflictingVariableNames() {
  const c = 'first';
  return b().then(c => {
    // second
    return c.second().then(c => {
        // third
        return c.third();
      });
  });
}

function conflictingVariableNamesWithShadowParam() {
  const c = 'first';
  return b().then(c => {
    // second
    return c.second().then(c => {
        // third
        return c.third(c => {
          c.other();
        });
      });
  });
}

function conflictingVariableNamesWithShadowDeclaration() {
  const c = 'first';
  return b().then(c => {
    // second
    return c.second().then(c => {
        // third
        return c.third(() => {
          const c = get();
          c.other();
        });
      });
  });
}

function thenTrueCatchFalse() {
  return b().then(c => true).catch(() => false);
}

const arrowNullError = val =>
  a.b(val).then(() => null).catch(err => err.message);

class Foo {
  a() {
    return b().then(c => c && c.d).catch(err => err);
  }
}

class Bar extends Base {
  a(...args) {
    this.ready(true);
    return Promise.resolve(this.run(args))
      .then(() => this.ok && this.ready(false))
      .catch(() => this.ok && this.ready(false));
  }
}
