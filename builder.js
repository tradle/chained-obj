
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var FormData = require('form-data');
var stringify = require('json-stable-stringify');
var concat = require('concat-stream');
var crypto = require('crypto');
var once = require('once');
var CombinedStream = require('combined-stream');
var dezalgo = require('dezalgo');
var CONSTANTS = require('./constants');

/**
 * multipart form builder with a deterministically generated boundary
 * to enable uniqueness per given content, and validation
 */
function Builder() {
  if (!(this instanceof Builder)) return new Builder();

  this._data = null;
  this._attachments = [];
}

/**
 * specify main data object
 * @param  {String|Object} json
 * @return {Builder} this Builder
 */
Builder.prototype.data = function(json) {
  json = typeof json === 'string' ? json : stringify(json);
  this._data = {
    name: CONSTANTS.DATA_ARG_NAME,
    value: json
  };

  return this;
}

/**
 * add an attachment
 * @param  {String} name
 * @param  {String|Buffer|Stream} value - see npm module form-data FormData.prototype.append for value constraints
 * @return {Builder} this Builder
 */
Builder.prototype.attach = function(name, value) {
  var self = this;

  assert(typeof value === 'string', 'value must be a path');

  this._attachments.push({
    name: name,
    value: path.resolve(value),
    isFile: true
  });

  return this;
}

/**
 * build the form to a buffer
 * @param  {Function} cb
 */
Builder.prototype.build = function(partial, cb) {
  var self = this;

  if (typeof partial === 'function') {
    cb = partial;
    partial = false;
  }

  cb = dezalgo(cb);
  if (!this._checkReady(cb)) return;

  if (!this._attachments.length) {
    return cb(null, self._data.value);
  }

  this.hash(function(err, hash) {
    if (err) return cb(err);

    toForm({
      parts: [self._data].concat(self._attachments),
      boundary: hash,
      partial: partial
    }, cb);
  });
}

Builder.prototype._checkReady = function(cb) {
  if (this._data == null) cb(new Error('"data" is required'));
  else return true;
}

Builder.prototype.partial = function(cb) {
  cb = dezalgo(cb);
  if (!this._checkReady(cb)) return;
}

Builder.prototype.hash = function(cb) {
  var self = this;

  var combinedStream = CombinedStream.create();
  for (var i = 0; i < this._attachments.length; i++) {
    var fPath = this._attachments[i].value;
    combinedStream.append(fs.createReadStream(fPath));
  }

  combinedStream.pipe(concat(function(buf) {
    buf = Buffer.concat([new Buffer(self._data.value), buf]);
    cb(null, getHash(buf));
  }));

  // toForm({
  //   attachments: this._attachments,
  //   boundary: CONSTANTS.DEFAULT_BOUNDARY
  // }, function(err, buf) {
  //   if (err) return cb(err);

  //   var hash = getHash(buf);
  //   console.log('hash', hash);
  //   cb(null, hash);
  // });
}

function toForm(options, cb) {
  cb = once(cb);

  var form = new FormData();

  // override boundary
  form._boundary = options.boundary || CONSTANTS.DEFAULT_BOUNDARY;
  options.parts.forEach(function(part) {
    var val = part.isFile ? fs.createReadStream(part.value) : part.value;
    form.append(part.name, val);
  });

  form.on('error', cb);

  form.pipe(concat({ encoding: 'buffer' }, function(buf) {
    // if (options.partial) {
    //   var top = new Buffer(scalp(boundary));
    //   buf = buf.slice(top.length);
    // }

    cb(null, buf);
  }));
}

// function scalp(boundary) {
//   return [boundary, CONSTANTS.JSON_CONTENT_DISP, form].join(FormData.LINE_BREAK);
// }

function getHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}


module.exports = Builder;
