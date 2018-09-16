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

function countUserVotes(userIds) {
  return getUsers(userIds).then(users => {
    return Promise.reduce(users, (acc, user) => {
      return user.getVoteCount().then(count => acc + count);
    });
  });
}

function detructure(key) {
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
