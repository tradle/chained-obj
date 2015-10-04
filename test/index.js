var fs = require('fs')
var path = require('path')
var test = require('tape')
var Readable = require('readable-stream')
var through2 = require('through2')
var streamEqual = require('stream-equal')

var kiki = require('kiki')
// var Identity = mi.Identity
var Keys = kiki.Keys
var Builder = require('../builder')
var Parser = require('../parser')
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

test('build multipart, parse', function (t) {
  t.plan(4)

  var data = {
    blah: 1
  }

  var attachments = [{
    name: 'yy',
    path: imgs[0]
  }]

  Builder()
    .data(data)
    .attach(attachments)
    .build(parse)

  function parse (err, build) {
    if (err) throw err

    var form = build.form
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

        t.equal(equal, true)
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

  function build (att, cb) {
    Builder()
      .data({
        blah: 1
      })
      .attach(attachments)
      .build(cb)
  }

  build(attachments, function (err, r1) {
    if (err) throw err

    build(attachments.reverse(), function (err, r2) {
      if (err) throw err

      t.deepEqual(r1, r2)
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
