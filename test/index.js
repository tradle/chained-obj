
var fs = require('fs');
var test = require('tape');
var path = require('path');
var bufferEqual = require('buffer-equal');
var streamEqual = require('stream-equal');
var concat = require('concat-stream');
var omit = require('object.omit');

var mi = require('midentity');
var Identity = mi.Identity;
var Keys = mi.Keys;
var Builder = require('../builder');
var Parser = require('../parser');
var imgs = [
  './test/logo.png',
  './test/logo1.png',
  './test/logo2.png'
]

test('build single-part, parse', function(t) {
  t.plan(6);

  var data = {
    blah: 1
  };

  parse(null, new Buffer(JSON.stringify(data)));
  parse(null, JSON.stringify(data));

  var b = new Builder()
    .data(data)
    .build(parse);


  function parse(err, buf) {
    if (err) throw err;

    Parser.parse(buf, function(err, parsed) {
      if (err) throw err;

      t.deepEqual(parsed.data.value, data);
      t.deepEqual(parsed.attachments, []);
    });
  }
});

test('build multipart, parse', function(t) {
  t.plan(4);

  var b = new Builder();
  var data = {
    blah: 1
  };

  var attachments = [{
    name: 'yy',
    path: imgs[0]
  }];

  b.data(data);
  attachments.forEach(b.attach, b);
  b.build(parse);

  function parse(err, buf) {
    if (err) throw err;

    Parser.parse(buf.toString('binary'), onParsed);
    Parser.parse(buf, onParsed);
  }

  function onParsed(err, parsed) {
    if (err) throw err;

    t.deepEqual(parsed.data.value, data);
    parsed.attachments.forEach(function(rAtt, i) {
      var a = fs.createReadStream(rAtt.path);
      var b = fs.createReadStream(attachments[i].path);
      streamEqual(a, b, function(err, equal) {
        t.equal(equal, true);
      });
    });
  }
});

test('deterministically sort attachments', function(t) {
  t.plan(1);

  var attachments = [{
    name: 'a',
    path: imgs[0]
  }, {
    name: 'b',
    path: imgs[1]
  }, {
    name: 'c',
    path: imgs[2]
  }];

  function build(att, cb) {
    var b = new Builder();
    var data = {
      blah: 1
    };

    b.data(data);
    attachments.forEach(b.attach, b);
    b.build(cb);
  }

  build(attachments, function(err, buf) {
    build(attachments.reverse(), function(err, rev) {
      t.ok(bufferEqual(buf, rev));
    });
  });
});

test('sign, hash, build, parse, verify', function(t) {
  var attachments = imgs.map(function(iPath) {
    return {
      name: path.basename(iPath, path.extname(iPath)),
      path: iPath
    }
  });

  var key = Keys.EC.gen({
    purpose: 'sign'
  });

  var b = new Builder();
  var data = {
    blah: 1
  };

  b.data(data);
  attachments.forEach(b.attach, b);
  b.signWith(key);
  b.build(function(err, buf) {
    if (err) throw err;

    Parser.parse(buf, function(err, parsed) {
      if (err) throw err;

      t.end();
    })
    .verifyWith(key);
  });
})
