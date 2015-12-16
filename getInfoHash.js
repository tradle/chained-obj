#!/usr/bin/env node

var path = require('path')
var fs = require('fs')
var Q = require('q')
var constants = require('@tradle/constants')
var utils = require('@tradle/utils')
var ChainedObj = require('./')
var Builder = ChainedObj.Builder
var filePath = process.argv[2]

var obj = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), filePath)))
if (!obj[constants.NONCE]) {
  throw new Error('object is missing nonce')
}

Builder()
  .data(obj)
  .build()
  .then(function (buf) {
    return Q.ninvoke(utils, 'getStorageKeyFor', buf)
  })
  .then(function (rootHash) {
    console.log(rootHash.toString('hex'))
  })
  .done()
