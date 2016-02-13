var Q = require('q')
var typeforce = require('typeforce')
var tutils = require('@tradle/utils')
var CONSTANTS = require('@tradle/constants')
var extend = require('xtend')
var utils = require('./utils')
var ROOT_HASH = CONSTANTS.ROOT_HASH
var PREV_HASH = CONSTANTS.PREV_HASH
var NONCE = CONSTANTS.NONCE
var SIGNEE = CONSTANTS.SIGNEE

/**
 * multipart form builder with a deterministically generated boundary
 * to enable uniqueness per given content, and validation
 */
function Builder () {
  if (!(this instanceof Builder)) return new Builder()

  this._data = null
}

/**
 * specify main data object
 * @param  {String|Buffer|Object} json
 * @return {Builder} this Builder
 */
Builder.prototype.data = function (json) {
  this._data = extend(parseJSON(json)) // to ensure it's stringified correctly (deterministically)
  return this
}

/**
 * @param  {Object|Function} signer - function that signs a Buffer, or an object with a sign function
 * @return {Builder} this Builder
 */
Builder.prototype.signWith = function (signer, signee) {
  var signFn = typeof signer === 'function' ? signer : signer.sign.bind(signer)
  typeforce('Function', signFn)

  this._signFn = signFn
  if (signee) {
    this._data[SIGNEE] = signee
  }

  return this
}

Builder.prototype.prev = function (prevHash) {
  this._data[PREV_HASH] = prevHash
  return this
}

Builder.prototype.root = function (rootHash) {
  this._data[ROOT_HASH] = rootHash
  return this
}

Builder.addNonce = function (data) {
  if (data[NONCE]) return Q.resolve()

  return Q.ninvoke(tutils, 'newMsgNonce')
    .then(function (nonce) {
      data[NONCE] = nonce
    })
}

Builder.prototype._addNonce = function () {
  return Builder.addNonce(this._data)
}

/**
 * build the form to a buffer
 * @param  {Function} cb
 */
Builder.prototype.build = function (noSign) {
  var self = this
  if (this._data == null) {
    throw new Error('"data" is required')
  }

  return this._addNonce()
    .then(function () {
      utils.validate(self._data)
      var data = toBuffer(self._data)
      if (noSign || !self._signFn) {
        return data
      }

      return signAndRebuild(data)
    })

  function signAndRebuild (data) {
    return Q.nfcall(self._signFn, data)
      .then(function (sig) {
        var json = parseJSON(data)
        json[CONSTANTS.SIG] = sig
        self.data(json)
        return self.build(true)
      })
  }
}

function parseJSON (json) {
  if (typeof json === 'string') return JSON.parse(json)
  if (Buffer.isBuffer(json)) return JSON.parse(json.toString(utils.BUFFER_ENCODING))

  return json
}

function toBuffer (json) {
  var buf = json
  if (typeof json === 'string') buf = new Buffer(json, utils.BUFFER_ENCODING)
  if (!Buffer.isBuffer(json)) buf = new Buffer(tutils.stringify(json), utils.BUFFER_ENCODING)

  return buf
}

module.exports = Builder
