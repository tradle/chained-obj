
var test = require('tape');
var Builder = require('../builder');
var Parser = require('../parser');
var fs = require('fs');
var IMG_PATH = './test/logo.png';
var bufferEqual = require('buffer-equal');
var streamEqual = require('stream-equal');
var concat = require('concat-stream');

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

      t.deepEqual(JSON.parse(parsed.data.value), data);
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
    value: IMG_PATH
  }];

  b.data(data);
  attachments.forEach(function(att) {
    b.attach(att.name, att.value)
  })

  b.build(parse);

  function parse(err, buf) {
    if (err) throw err;

    Parser.parse(buf.toString('binary'), onParsed);
    Parser.parse(buf, onParsed);
  }

  function onParsed(err, parsed) {
    if (err) throw err;

    t.deepEqual(JSON.parse(parsed.data.value), data);
    parsed.attachments.forEach(function(rAtt, i) {
      var a = fs.createReadStream(rAtt.value);
      var b = fs.createReadStream(attachments[i].value);
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
    value: IMG_PATH
  }, {
    name: 'b',
    value: IMG_PATH
  }, {
    name: 'c',
    value: IMG_PATH
  }];

  function build(att, cb) {
    var b = new Builder();
    var data = {
      blah: 1
    };

    b.data(data);
    attachments.forEach(function(att) {
      b.attach(att.name, att.value)
    })

    b.build(cb);
  }

  build(attachments, function(err, buf) {
    build(attachments.reverse(), function(err, rev) {
      t.ok(bufferEqual(buf, rev));
    });
  });
});
// function imageStream() {
//   return fs.createReadStream('/Users/tenaciousmv/Pictures/yy antelope.jpg');
// };

// var form = buildForm();
// form.getLength(function(err, length) {
//   var headers = form.getHeaders();
//   headers['Content-Length'] = length;
//   var req = new MockReq({
//     method: 'POST',
//     headers: headers
//   });

//   form.pipe(req);
//   incoming.parse(req, function(err, fields, files) {
//     console.log('Received, parsed', arguments);
//   });
// });

// function fromPartial(form) {
//   var boundary = guessBoundary(form);

//   if (!boundary) throw new Error('no multipart boundary found');

//   if (form.slice(0, boundary.length) === boundary) return form;

//   return [boundary, JSON_CONTENT_DISP, form].join(FormData.LINE_BREAK);
// }

// function guessBoundary(form) {
//   return find(form.split(FormData.LINE_BREAK), function(part) {
//     return /----/.test(part);
//   });
// }

// function generateBoundary(parts) {
//   var all = parts.sort().join('');
//   crypto.createHash('sha256').update(all).digest('hex');
// }

// function partialForm(cb) {
//   buildForm().pipe(concat(function(buf) {
//     var str = buf.toString();
//     var idx = str.indexOf('\n', str.indexOf('\n') + 1);
//     cb(str.slice(idx + 1));
//   }));
// }

// // test build/recover partial form
// partialForm(function(partial) {
//   var recovered = fromPartial(partial);
//   buildForm().pipe(concat(function(buf) {
//     var full = buf.toString();
//     // var d = diff.diffWordsWithSpace(full, recovered);
//     // d.forEach(function(part) {
//     //   console.log(part);
//     // });
//     fs.writeFile('./test/full.form', full);
//     fs.writeFile('./test/recovered.form', recovered);
//     console.log(recovered === full);
//   }));
// });
