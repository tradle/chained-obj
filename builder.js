var fs = require('fs')
var path = require('path')
var mime = require('mime-types')
var typeforce = require('typeforce')
var bufIndexOf = require('buffer-indexof')
var FormData = require('form-data')
var stringify = require('tradle-utils').stringify
var concat = require('concat-stream')
var crypto = require('crypto')
var safe = require('safecb')
var find = require('array-find')
var CONSTANTS = require('./constants')
var BUFFER_ENC = 'binary'

/**
 * multipart form builder with a deterministically generated boundary
 * to enable uniqueness per given content, and validation
 */
function Builder () {
  if (!(this instanceof Builder)) return new Builder()

  this._data = null
  this._attachments = []
}

/**
 * specify main data object
 * @param  {String|Buffer|Object} json
 * @return {Builder} this Builder
 */
Builder.prototype.data = function (json) {
  this._data = parseJSON(json) // to ensure it's stringified correctly (deterministically)
  this._hashed = false
  return this
}

/**
 * add an attachment
 * @param  {Object} options
 * @param  {String} options.name - attachment name
 * @param  {String} options.path - attachment file path
 * @param  {String} options.contentType (optional)
 * @return {Builder} this Builder
 */
Builder.prototype.attach = function (options) {
  typeforce({
    path: 'String',
    name: 'String'
  }, options)

  if (this._getAttachment(options.name)) throw new Error('duplicate attachment')

  this._attachments.push({
    name: options.name,
    path: path.resolve(options.path),
    contentType: options.contentType || mime.lookup(options.path),
    isFile: true
  })

  this._hashed = false
  return this
}

/**
 * @param  {Object|Function} signer - function that signs a Buffer, or an object with a sign function
 * @return {Builder} this Builder
 */
Builder.prototype.signWith = function (signer) {
  this._signer = signer
  return this
}

/**
 * build the form to a buffer
 * @param  {Function} cb
 */
Builder.prototype.build = function (cb) {
  var self = this

  cb = safe(cb)
  if (!this._checkReady(cb)) return

  this.hash(function (err, hash) {
    if (err) return cb(err)

    mkForm(function (err, result) {
      if (err) return cb(err)
      if (!self._signer) return cb(null, result)

      var sig
      if (self._signer.sign) {
        sig = self._signer.sign(result.form)
      } else {
        sig = self._signer(result.form)
      }

      delete self._signer
      var json = parseJSON(self._data)
      json._sig = sig
      self.data(json)
      self.build(cb)
    })

    function mkForm (onmade) {
      if (!self._attachments.length) {
        return onmade(null, {
          form: toBuffer(self._data)
        })
      }

      toForm({
        parts: self._getParts(),
        boundary: hash
      }, onmade)
    }
  })
}

Builder.prototype._getParts = function () {
  var parts = [{
    name: CONSTANTS.DATA_ARG_NAME,
    value: this._data
  }]

  parts.push.apply(parts, this._attachments)
  return parts
}

Builder.prototype._getAttachment = function (name) {
  return find(this._attachments, function (a) {
    return a.name === name
  })
}

Builder.prototype.getAttachmentHash = function (name, cb) {
  var self = this

  this.hash(function (err) {
    if (err) return cb(err)

    var att = self._getAttachment(name)
    if (!att) return cb(new Error('attachment not found'))

    return cb(null, att.hash)
  })
}

Builder.prototype._checkReady = function (cb) {
  if (this._data == null) cb(new Error('"data" is required'))
  else return true
}

Builder.prototype._readAttachments = function (cb) {
  cb = safe(cb)

  var togo = this._attachments.length + 1
  this._attachments.forEach(function (a) {
    if (a.value) return finish()

    fs.createReadStream(a.path)
      .on('error', cb)
      .pipe(concat(function (buf) {
        a.value = buf
        finish()
      }))
  })

  finish()

  function finish () {
    if (--togo === 0) cb()
  }
}

Builder.prototype._hashAndSort = function () {
  if (this._hashed) return

  this._attachments.forEach(function (a) {
    if (!a.hash) a.hash = getHash(a.value)
  })

  this._attachments.sort(function (a, b) {
    // alphabetical by hash of content
    a = a.hash
    b = b.hash
    if (a === b) throw new Error('duplicate attachment found')

    return a < b ? -1 : 1
  })

  this._hashed = true
}

Builder.prototype.hash = function (cb) {
  var self = this

  this._readAttachments(function (err) {
    if (err) return cb(err)

    try {
      self._hashAndSort()
    } catch(err) {
      return cb(err)
    }

    var hashes = self._attachments.map(function (a) {
      return a.hash
    })

    hashes.unshift(getHash(self._data))
    cb(null, getHash(hashes.join('')))
  })
}

function toForm (options, cb) {
  cb = safe(cb)

  var form = new FormData()

  // override boundary
  var boundary = form._boundary = options.boundary || CONSTANTS.DEFAULT_BOUNDARY
  options.parts.forEach(function (part) {
    // var val = part.isFile ? fs.createReadStream(part.value) : part.value
    var opts = {}
    if (part.isFile) {
      opts.filename = part.hash
    }

    form.append(part.name, toBuffer(part.value), opts)
  })

  form.on('error', cb)

  form.pipe(concat({ encoding: 'buffer' }, function (buf) {
    cb(null, {
      form: buf,
      boundary: boundary
    })
  }))
}

function getHash (data) {
  // if hash is contained in file, hash the hash till it isn't
  data = toBuffer(data)
  var idx
  var hash
  do {
    if (hash) console.log('Miracle, file with its own hash:', data, hash)

    hash = crypto.createHash('sha256').update(hash || data).digest('hex').slice(0, 50)
    idx = bufIndexOf(data, hash)
  }
  while (idx !== -1)

  return hash
}

function parseJSON (json) {
  if (typeof json === 'string') return JSON.parse(json)
  if (Buffer.isBuffer(json)) return JSON.parse(json.toString(BUFFER_ENC))

  return json
}

function toBuffer (json) {
  var buf = json
  if (typeof json === 'string') buf = new Buffer(json, BUFFER_ENC)
  if (!Buffer.isBuffer(json)) buf = new Buffer(stringify(json), BUFFER_ENC)

  return buf
}

module.exports = Builder
