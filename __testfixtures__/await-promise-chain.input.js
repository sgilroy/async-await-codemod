async function thenChain() {
  console.log('before');

  // comment about b
  const e = await b().then(c => {
    // comment before using c
    return c.d();
  });

  return 'end with ' + e;
}

function thenChainNotAsync() {
  return b().then(c => {
    return c.d();
  }).then(e => {
    return 'end with ' + e;
  });
}

async function longThenChain() {
  const end = await b().then(c => {
    c.readyForD = true;
    return c.d();
  }).then(e => {
    // comment about e
    return e.f();
  });

  return 'end with ' + end;
}

async function thenCatchChain() {
  console.log('before');

  // comment about b
  const e = await b().then(c => {
    // comment before using c
    return c.d();
  }).catch(error => {
    console.error(error);
  });

  return 'end with ' + e;
}

async function returnUndefinedChained() {
  const undefinedParam = await b().then(() => {});
  return c(undefinedParam);
}

async function awaitExpression() {
  await Factory.create('coach', {})
    .then(coach => {
      return client.put('/coach/' + coach.id);
    });
}

async function returnAwaitExpression() {
  return await Factory.create('coach', {})
    .then(coach => {
      return client.put('/coach/' + coach.id);
    });
}

async function returnAwaitExpressionSync() {
  return await Factory.create('coach', {})
    .then(coach => {
      sync(coach);
    });
}

async function conflictingVariableNamesWithShadowDeclaration() {
  const c = 'first';
  return await b().then(c => {
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
