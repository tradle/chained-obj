var assert = require('assert')
var omit = require('object.omit')
var Q = require('q')
var CONSTANTS = require('@tradle/constants')
var Builder = require('./builder')
var utils = require('./utils')
var SIG = CONSTANTS.SIG

module.exports = Parser

function Parser () {
  if (!(this instanceof Parser)) return new Parser()
}

/**
 * Parse data and attachments from form
 * @param  {String|Buffer} form
 * @param  {Function} cb
 * @return {Parser} this Parser instance
 */
Parser.prototype.parse = function (data) {
  assert(typeof data === 'string' || Buffer.isBuffer(data))

  try {
    var result = JSON.parse(data.toString(utils.BUFFER_ENCODING))
  } catch (err) {
    return Q.reject(new Error('invalid json'))
  }

  return this._validate(result)
    .then(function () {
      return {
        data: result
      }
    })
}

/**
 * Verify signature
 * @param  {Object|Function} verifier - verify function, or object with verify function
 * @return {Parser} this Parser instance
 */
Parser.prototype.verifyWith = function (verifier) {
  // TODO: move _verify to a separate state object
  this._verify = typeof verifier === 'function' ?
    verifier :
    verifier.verify.bind(verifier)

  return this
}

Parser.prototype._validate = function (data, noVerify) {
  var self = this
  try {
    utils.validate(data)
  } catch (err) {
    return Q.reject(err)
  }

  var unsigned
  var verify = !noVerify && this._verify
  var sig
  if (verify) {
    delete self._verify
    if (!data[SIG]) Q.reject(new Error("object is not signed, can't verify"))

    sig = data[SIG]
    unsigned = omit(data, SIG)
  }

  return new Builder()
    .data(unsigned || data)
    .build()
    .then(function (buf) {
      if (sig && verify) {
        return verifyAndRevalidate(buf)
      }

      return JSON.parse(buf)
    })

  function verifyAndRevalidate (buf) {
    return Q.nfcall(verify, buf, sig)
      .then(function (verified) {
        if (!verified) throw new Error('invalid signature')

        return self._validate(JSON.parse(buf), true)
      })
  }
}

Parser.parse = function (buf, cb) {
  return new Parser().parse(buf, cb)
}
