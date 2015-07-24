# chained-obj

Builder and parser for objects stored by [Tradle](https://github.com/tradle/about/wiki) on chain. Currently uses multipart to store arbitrary JSON data + attachments. These objects are later encrypted and put on-chain.

_this module is used by [Tradle](https://github.com/tradle/about/wiki)_

# Usage

```js
var ChainedObj = require('chained-obj')
var Builder = ChainedObj.Builder
var Parser = ChainedObj.Parser
var b = new Builder()
  // required
  .data({
    some: 'json'
  })
  // optional
  .attach([
    { name: 'headshot', path: './path/to/attachment1' },
    { name: 'passport', path: './path/to/attachment2' }
  ])
  // optional
  .signWith(key) // a key from [kiki](https://npmjs.org/package/kiki) or a key conforming to its API
  .build(function (err, result) {
    // result consists of the form and the multipart boundary used
    // {
    //   form: Buffer,
    //   boundary: String
    // }
  })
  
var p = new Parser()
  // optional
  .verifyWith(key) // a key from [kiki](https://npmjs.org/package/kiki) or a key   
  .parse(formBuf, function (err, parsed) {
    // parsed consists of the data and attachments
    // {
    //   data: Buffer,
    //   attachments: [
    //     {
    //       name: String,
    //       path: String,
    //       contentType: String
    //     }
    //   ]
    // }
  })
```
