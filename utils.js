var CONSTANTS = require('@tradle/constants')
var NONCE = CONSTANTS.NONCE
var CUR_HASH = CONSTANTS.CUR_HASH
var ROOT_HASH = CONSTANTS.ROOT_HASH
var PREV_HASH = CONSTANTS.PREV_HASH
// var SIG = CONSTANTS.SIG
// var SIGNEE = CONSTANTS.SIGNEE

module.exports = {
  BUFFER_ENCODING: 'utf8',
  validate: function (obj) {
    if (typeof obj === 'string' || Buffer.isBuffer(obj)) {
      obj = JSON.parse(obj)
    }

    if (!obj[NONCE]) {
      throw new Error('missing message nonce')
    }

    if (obj[CUR_HASH]) {
      throw new Error('object cannot contain its own current hash')
    }

    if (obj[ROOT_HASH] || obj[PREV_HASH]) {
      if (!(obj[ROOT_HASH] && obj[PREV_HASH])) {
        throw new Error(
          'versioned objects must have both ' + PREV_HASH + ' and ' + ROOT_HASH
        )
      }
    }

    // if (obj[SIG] || obj[SIGNEE]) {
    //   if (!(obj[SIG] && obj[SIGNEE])) {
    //     throw new Error(
    //       'signed objects must have both ' + SIG + ' and ' + SIGNEE
    //     )
    //   }
    // }
  }
}
