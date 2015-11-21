var fs = require('fs')
var path = require('path')
var test = require('tape')
var Readable = require('readable-stream')
var through2 = require('through2')
var streamEqual = require('stream-equal')
var mime = require('mime-types')
var DataURI = require('datauri')

var kiki = require('@tradle/kiki')
// var Identity = mi.Identity
var Keys = kiki.Keys
var Builder = require('../builder')
var Parser = require('../parser')
var NONCE = require('@tradle/constants').NONCE
var imgs = [
  './test/logo.png',
  './test/logo1.png',
  './test/logo2.png'
]

test('build single-part, parse', function (t) {
  t.plan(6)

  var data = {
    blah: 1
  }

  data[NONCE] = '1234'
  parse(null, { form: new Buffer(JSON.stringify(data)) })
  parse(null, { form: JSON.stringify(data) })

  new Builder()
    .data(data)
    .build(parse)

  function parse (err, build) {
    if (err) throw err

    Parser.parse(build.form, function (err, parsed) {
      if (err) throw err

      t.deepEqual(parsed.data, data)
      t.deepEqual(parsed.attachments, [])
    })
  }
})

test('streaming parse', function (t) {
  var num = 5
  t.plan(num * 2)

  var data = []
  for (var i = 0; i < num; i++) {
    data.push({
      blah: i
    })

    data[i][NONCE] = '' + i
  }

  var stream = new Readable({ objectMode: true })
  data.forEach(function (d) {
    stream.push(new Buffer(JSON.stringify(d)))
  })

  stream.push(null)
  stream
    .pipe(new Parser())
    .pipe(through2.obj(function transform (parsed, enc, done) {
      t.deepEqual(parsed.data, data.shift())
      t.deepEqual(parsed.attachments, [])
      done()
    }))
})

test('build multipart (from path / from file), parse', function (t) {
  t.plan(6)

  var data = {
    blah: 1,
    _z: '123'
  }

  var att = {
    name: 'yy',
    path: imgs[0]
  }

  var attachments = [att]
  var firstForm
  var togo = 3
  pathBased()
  contentBased()

  function pathBased () {
    Builder()
      .data(data)
      .attach(attachments)
      .build(check)
  }

  function contentBased () {
    fs.readFile(att.path, function (err, buf) {
      if (err) throw err

      Builder()
        .data(data)
        .attach([{ name: att.name, buffer: buf, contentType: mime.lookup(att.path) }])
        .build(check)
    })

    var encoder = new DataURI()
    encoder.on('encoded', function (dataURI) {
      Builder()
        .data(data)
        .attach([{ name: att.name, dataURI: dataURI }])
        .build(check)
    })

    encoder.encode(att.path)
  }

  function check (err, build) {
    if (err) throw err

    var form = build.form
    if (firstForm) {
      t.deepEqual(form, firstForm)
    } else {
      firstForm = form
    }

    if (--togo === 0) parse(form)
  }

  function parse (form) {
    Parser.parse(form.toString('binary'), onParsed)
    Parser.parse(form, onParsed)
  }

  function onParsed (err, parsed) {
    if (err) throw err

    t.deepEqual(parsed.data, data)
    parsed.attachments.forEach(function (rAtt, i) {
      var a = fs.createReadStream(rAtt.path)
      var b = fs.createReadStream(attachments[i].path)
      streamEqual(a, b, function (err, equal) {
        if (err) throw err

        t.assert(equal)
      })
    })
  }
})

test('deterministically sort attachments', function (t) {
  t.plan(1)

  var attachments = [{
    name: 'a',
    path: imgs[0]
  }, {
    name: 'b',
    path: imgs[1]
  }, {
    name: 'c',
    path: imgs[2]
  }]

  var data = {
    blah: 1
  }

  function build (att, cb) {
    Builder()
      .data(data)
      .attach(attachments)
      .build(cb)
  }

  Builder.addNonce(data, function () {
    build(attachments, function (err, r1) {
      if (err) throw err

      build(attachments.reverse(), function (err, r2) {
        if (err) throw err

        t.deepEqual(r1, r2)
      })
    })
  })
})

test('sign, hash, build, parse, verify', endToEnd.bind(null, false))
test('sign, hash, build, parse, verify (with attachments)', endToEnd.bind(null, true))

function endToEnd (withAttachments, t) {
  var attachments = withAttachments && imgs.map(function (iPath) {
      return {
        name: path.basename(iPath, path.extname(iPath)),
        path: iPath
      }
    })

  var key = Keys.EC.gen({
    purpose: 'sign'
  })

  var data = {
    blah: 1
  }

  // data[NONCE] = '123'
  var b = new Builder()
    .data(data)
    .signWith(key)

  if (withAttachments) b.attach(attachments)

  b.build(function (err, build) {
    if (err) throw err

    Parser.parse(build.form, function (err, parsed) {
      if (err) throw err

      t.end()
    })
    .verifyWith(key)
  })
}
