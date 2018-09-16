## async-await-codemod

[![Build Status](https://img.shields.io/travis/sgilroy/async-await-codemod.svg?style=flat-square)](https://travis-ci.org/sgilroy/async-await-codemod) [![Code Style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

This repository contains a codemod script for use with
[JSCodeshift](https://github.com/facebook/jscodeshift) that migrates promise-based functions to use async/await syntax.

The excellent [sinon-codemod](https://github.com/hurrymaplelad/sinon-codemod) repository was used as inspiration and served as a template for this repository.

This codemod is based in part on work done by @cpojer https://github.com/cpojer/js-codemod/pull/49/commits/19ed546d8a47127d3d115f933d924106c98e1b8b
and the further work of @cassilup https://github.com/cassilup/async-await-codemod-demo

### Setup & Run

- `npm install -g jscodeshift`
- `git clone https://github.com/sgilroy/async-await-codemod.git` or download a zip file
  from `https://github.com/sgilroy/async-await-codemod/archive/master.zip`
- Run `npm install` in the async-await-codemod directory
  - Alternatively, run [`yarn`](https://yarnpkg.com/) to install in the
    async-await-codemod directory
- `jscodeshift -t <codemod-script> <path>`
- Use the `-d` option for a dry-run and use `-p` to print the output
  for comparison

### async-await

ES2017 natively supports a special syntax for working with promises called "async/await".

With promises:

```js
function makeRequest() {
  return getJSON().then(data => {
    console.log(data);
    return 'done';
  });
}
```

With async/await:

```js
async function makeRequestFunction() {
  const data = await getJSON();
  console.log(data);
  return 'done';
}
```

### Included Scripts

#### `async-await`

Converts each asynchronous function (a function which contains a `.then()` call) to `async`, and uses `await` instead
of `.then()` to simplify the behavior of using promises synchronously.

```sh
jscodeshift -t async-await-codemod/async-await.js <path>
```

#### `async-promise-chain`

Unravels chained promise calls of the style `foo.then().then()` as multiple `await` calls. Note that this changes the
structure and scope of blocks of code and can thus result in different behavior, such as by variables being in scope
that otherwise would not.

This should generally be used after the `async-await` codemod, and the changes should be examined and tested carefully
to avoid unwanted bugs or subtle problems.

```sh
jscodeshift -t async-await-codemod/async-promise-chain.js <path>
```
