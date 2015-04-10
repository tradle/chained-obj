
var formidable = require('formidable');
var Builder = require('./builder');
var MockReq = require('mock-req');
var FormData = require('form-data');
var bufferEqual = require('buffer-equal');
var buf2stream = require('simple-bufferstream');
var concat = require('concat-stream');
var once = require('once');
var isStream = require('isstream');
var dezalgo = require('dezalgo');
var assert = require('assert');
var CONSTANTS = require('./constants');

function Parser() {
  if (!(this instanceof Parser)) return new Parser();

  this._attachments = [];
}

/**
 * Parse data and attachments from form
 * @param  {String|Buffer} form
 * @param  {Function} cb
 */
Parser.prototype.parse = function(form, cb) {
  var self = this;

  assert(typeof form === 'string' || Buffer.isBuffer(form) || isStream(form));

  firstLine(form, function(line) {
    if (line.slice(0, 2) === '--') {
      // multipart
      self._boundary = line.slice(2); // cut off leading "--"
      self._parse(form, cb);
    }
    else {
      // one part
      self._data = {
        name: CONSTANTS.DATA_ARG_NAME,
        value: form.toString()
      }

      cb(null, self._result());
    }
  });
}

/**
 * Parse data and attachments from form
 * @param  {String|Buffer} form
 * @param  {Function} cb
 */
Parser.prototype._parse = function(form, cb) {
  var self = this;
  var attachments = this._attachments;
  var error;
  var togo = 0;

  cb = once(cb);

  var incoming = new formidable.IncomingForm();

  incoming.on('fileBegin', push);
  incoming.on('field', push)
  incoming.on('error', cb);

  var headers = {};
  headers['Content-Length'] = form.length;
  headers['Content-Type'] = 'multipart/form-data; boundary=' + this._boundary;
  var req = new MockReq({
    method: 'POST',
    headers: headers
  });

  toStream(form).pipe(req);

  incoming.parse(req, function(err, fields, files) {
    if (err) return cb(err);

    self._validate(function(err, valid) {
      if (err) return cb(err);
      if (!valid) return cb(new Error('invalid form'));

      cb(null, self._result());
    });
  });

  function push(key, val) {
    if (!self._data) {
      self._data = {
        name: key,
        value: val
      }
    }
    else {
      attachments.push({
        name: key,
        value: val.path
      });
    }
  }
}

Parser.prototype._result = function() {
  return {
    data: this._data,
    attachments: this._attachments
  }
}

Parser.prototype._validate = function(cb) {
  var self = this;
  var b = new Builder();
  b.data(this._data.value);
  this._attachments.forEach(function(att) {
    b.attach(att.name, att.value);
  });

  b.hash(function(err, hash) {
    if (err) return cb(err);
    cb(null, hash === self._boundary);
  })
}

Parser.parse = function(buf, cb) {
  return new Parser().parse(buf, cb);
}

function firstLine(buf, cb) {
  cb = once(dezalgo(cb));
  if (typeof buf === 'string') return cb(buf.slice(0, buf.indexOf(FormData.LINE_BREAK)));

  var stream = buf2stream(buf);
  var line = '';
  stream.on('data', function(data){
    var str = data.toString();
    var breakIdx = str.indexOf(FormData.LINE_BREAK);
    if (breakIdx === -1) {
      line += str;
    }
    else {
      line += str.slice(0, breakIdx);
      stream.destroy();
      cb(line);
    }
  });

  stream.on('end', function() {
    cb(line);
  });
}

function toStream(data) {
  if (typeof data === 'string') data = new Buffer(data, 'binary');
  if (Buffer.isBuffer(data)) data = buf2stream(data);
  if (!isStream(data)) throw new Error('invalid format, provide string, Buffer or Stream');

  return data;
}

module.exports = Parser;
