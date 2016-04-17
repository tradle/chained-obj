var test = require('tape')
var kiki = require('@tradle/kiki')
// var Identity = mi.Identity
var Keys = kiki.Keys
var Builder = require('../builder')
var Parser = require('../parser')
var constants = require('@tradle/constants')
var NONCE = constants.NONCE

test('build, parse', function (t) {
  var data = {
    blah: 1
  }

  data[NONCE] = '1234'
  Parser.parse(new Buffer(JSON.stringify(data))).done()
  Parser.parse(JSON.stringify(data)).done()

  new Builder()
    .data(data)
    .build()
    .then(function (buf) {
      return Parser.parse(buf)
    })
    .then(function (parsed) {
      t.deepEqual(parsed.data, data)
      t.end()
    })
    .done()
})

test('fancy chars', function (t) {
  var data = {
    blah: '€1'
  }

  data[NONCE] = '1234'
  Parser.parse(new Buffer(JSON.stringify(data))).done()
  Parser.parse(JSON.stringify(data)).done()

  new Builder()
    .data(data)
    .build()
    .then(function (buf) {
      return Parser.parse(buf)
    })
    .then(function (parsed) {
      t.deepEqual(parsed.data, data)
      t.end()
    })
    .done()
})

test('sign, hash, build, parse, verify', function (t) {
  var key = Keys.EC.gen({
    purpose: 'sign'
  })

  var data = {
    blah: 1
  }

  // data[NONCE] = '123'
  new Builder()
    .data(data)
    .signWith(key, 'me')
    .build()
    .then(function (buf) {
      return new Parser()
        .verifyWith(key)
        .parse(buf)
    })
    .done(function () {
      t.pass('round trip complete')
      t.end()
    })
})
