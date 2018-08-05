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