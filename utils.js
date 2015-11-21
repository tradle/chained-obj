var CONSTANTS = require('@tradle/constants')
var NONCE = CONSTANTS.NONCE
var CUR_HASH = CONSTANTS.CUR_HASH
var ROOT_HASH = CONSTANTS.ROOT_HASH
var PREV_HASH = CONSTANTS.PREV_HASH

module.exports = {
  validate: function (obj) {
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

  }
}
