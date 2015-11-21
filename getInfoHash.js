#!/usr/bin/env node

var path = require('path')
var fs = require('fs')
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
  .build(function (err, result) {
    if (err) throw err

    utils.getStorageKeyFor(result.form, function (err, rootHash) {
      console.log(err || rootHash.toString('hex'))
    })
  })
