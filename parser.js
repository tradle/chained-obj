var util = require('util')
var Transform = require('stream').Transform
var formidable = require('formidable')
var MockReq = require('mock-req')
var FormData = require('form-data')
var buf2stream = require('simple-bufferstream')
var isStream = require('isstream')
var assert = require('assert')
var safe = require('safecb')
var omit = require('object.omit')
var CONSTANTS = require('tradle-constants')
var Builder = require('./builder')
var SIG = CONSTANTS.SIG
var NONCE = CONSTANTS.NONCE

module.exports = Parser
util.inherits(Parser, Transform)

function Parser () {
  if (!(this instanceof Parser)) return new Parser()

  Transform.call(this, {
    objectMode: true
  })
}

Parser.prototype._transform = function (data, enc, cb) {
  var self = this
  this.parse(data, function (err, parsed) {
    if (err) return cb(err)

    self.push(parsed)
    cb()
  })
}

/**
 * Parse data and attachments from form
 * @param  {String|Buffer} form
 * @param  {Function} cb
 * @return {Parser} this Parser instance
 */
Parser.prototype.parse = function (form, cb) {
  var self = this

  assert(typeof form === 'string' || Buffer.isBuffer(form) || isStream(form))

  firstLine(form, function (line) {
    if (line.slice(0, 2) === '--') {
      // multipart
      var boundary = line.slice(2) // cut off leading "--"
      self._parse(form, boundary, cb)
    } else {
      // one part
      var result = {
        data: JSON.parse(form.toString()),
        attachments: []
      }

      self._validate(result, function (err) {
        if (err) return cb(err)

        cb(null, result)
      })
    }
  })

  return this
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

/**
 * Parse data and attachments from form
 * @param  {String|Buffer} form
 * @param  {Function} cb
 */
Parser.prototype._parse = function (form, boundary, cb) {
  var self = this
  var data
  var attachments = []

  cb = safe(cb)

  var incoming = new formidable.IncomingForm()
    .on('fileBegin', push)
    .on('field', push)
    .on('error', cb)

  var headers = {}
  headers['Content-Length'] = form.length
  headers['Content-Type'] = 'multipart/form-data; boundary=' + boundary
  var req = new MockReq({
    method: 'POST',
    headers: headers
  })

  toStream(form).pipe(req)

  incoming.parse(req, function (err, fields, files) {
    if (err) return cb(err)

    var result = {
      data: data,
      attachments: attachments,
      boundary: boundary
    }

    self._validate(result, function (err, valid) {
      if (err) return cb(err)
      if (!valid) return cb(new Error('invalid form'))

      cb(null, result)
    })
  })

  function push (key, val) {
    if (!data) {
      data = JSON.parse(val)
    } else {
      attachments.push({
        name: key,
        path: val.path,
        contentType: val.type
      })
    }
  }
}

Parser.prototype._validate = function (result, cb) {
  var self = this
  cb = safe(cb)

  var data = result.data
  if (!result.data[NONCE]) {
    return cb(new Error('missing message nonce'))
  }

  var unsigned
  var verify = this._verify
  var sig
  if (verify) {
    delete self._verify
    if (!data[SIG]) return cb(new Error("object is not signed, can't verify"))

    sig = data[SIG]
    unsigned = omit(data, SIG)
  }

  var b = new Builder()
  b.data(unsigned || data)
  result.attachments.forEach(b.attach, b)

  b.build(function (err, build) {
    if (err) return cb(err)
    if (sig && verify) {
      var form = build.form
      return verify(form, sig, function (err, verified) {
        if (err) return cb(err)
        if (!verified) return cb(new Error('invalid signature'))

        return self._validate(result, cb)
      })
    }

    cb(null, build.boundary === result.boundary)
  })
}

Parser.parse = function (buf, cb) {
  return new Parser().parse(buf, cb)
}

function firstLine (buf, cb) {
  cb = safe(cb)
  if (typeof buf === 'string') return cb(buf.slice(0, buf.indexOf(FormData.LINE_BREAK)))

  var stream = buf2stream(buf)
  var line = ''
  stream.on('data', function (data) {
    var str = data.toString()
    var breakIdx = str.indexOf(FormData.LINE_BREAK)
    if (breakIdx === -1) {
      line += str
    } else {
      line += str.slice(0, breakIdx)
      stream.destroy()
      cb(line)
    }
  })

  stream.on('end', function () {
    cb(line)
  })
}

function toStream (data) {
  if (typeof data === 'string') data = new Buffer(data, 'binary')
  if (Buffer.isBuffer(data)) data = buf2stream(data)
  if (!isStream(data)) throw new Error('invalid format, provide string, Buffer or Stream')

  return data
}
