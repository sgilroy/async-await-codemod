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
