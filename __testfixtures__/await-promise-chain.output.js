async function thenChain() {
  console.log('before');

  // comment about b
  const c = await b();

  // comment before using c
  const e = await c.d();

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
  const c = await b();
  c.readyForD = true;
  const e = await c.d();
  // comment about e
  const end = await e.f();

  return 'end with ' + end;
}

async function thenCatchChain() {
  console.log('before');

  try {
    // comment about b
    const c = await b();

    // comment before using c
    const e = await c.d();
  } catch (error) {
    console.error(error);
  }

  return 'end with ' + e;
}

async function returnUndefinedChained() {
  const undefinedParam = await b().then(() => {});
  return c(undefinedParam);
}

async function awaitExpression() {
  const coach = await Factory.create('coach', {});
  await client.put('/coach/' + coach.id);
}

async function returnAwaitExpression() {
  const coach = await Factory.create('coach', {});
  return await client.put('/coach/' + coach.id);
}

async function returnAwaitExpressionSync() {
  const coach = await Factory.create('coach', {});
  sync(coach);
}
