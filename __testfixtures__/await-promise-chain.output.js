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

async function conflictingVariableNamesWithShadowDeclaration() {
  const c = 'first';
  const c2 = await b();

  // second
  const c3 = await c2.second();

  // third
  return await c3.third(() => {
    const c = get();
    c.other();
  });
}

async function conflictingSpreadDeclaration() {
  console.log('before');

  // comment about b
  const [req, e2] = await b();

  // comment before using e
  const e = await e2.d(req);

  return 'end with ' + e;
}

async function conflictingDestructuredSpreadDeclaration() {
  console.log('before');

  // comment about b
  const [req2, e2] = await b();

  // comment before using e
  const [req, e] = await e2.d(req2);

  return 'end with ' + e + req.id();
}

async function awaitConditionalReturn() {
  const coach = await Factory.create('coach', {});
  if (!coach.good) {
    return;
  }
  return await client.put('/coach/' + coach.id);
}

async function awaitSync() {
  const self = this;

  const patient = await Factory.create('patient');
  self.patient = patient;
  const device = await Factory.create('mobile_device', {_user: self.patient});
  self.device = device;

  pushEvents.configure();
}