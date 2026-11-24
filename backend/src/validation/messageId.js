const MESSAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

function isValidMessageId(messageId) {
  return typeof messageId === 'string' && MESSAGE_ID_PATTERN.test(messageId)
}

module.exports = { isValidMessageId }
