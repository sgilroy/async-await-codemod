async function thenChain() {
  const e = await b().then(c => {
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
