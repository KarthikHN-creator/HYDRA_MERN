const HttpError = require('../utils/HttpError')
const { rejectUnknownFields } = require('./commonValidation')

const modes = ['manual', 'voice', 'gesture', 'object-picking']
const themes = ['light', 'dark']

function validateSettingsUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object')
  }
  rejectUnknownFields(body, ['preferredControlMode', 'theme', 'motionConfirmation'])
  if (Object.keys(body).length === 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Provide at least one setting to update')
  }

  if (Object.hasOwn(body, 'preferredControlMode') && !modes.includes(body.preferredControlMode)) {
    throw new HttpError(400, 'VALIDATION_ERROR', `preferredControlMode must be one of: ${modes.join(', ')}`)
  }
  if (Object.hasOwn(body, 'theme') && !themes.includes(body.theme)) {
    throw new HttpError(400, 'VALIDATION_ERROR', `theme must be one of: ${themes.join(', ')}`)
  }
  if (Object.hasOwn(body, 'motionConfirmation') && typeof body.motionConfirmation !== 'boolean') {
    throw new HttpError(400, 'VALIDATION_ERROR', 'motionConfirmation must be a boolean')
  }

  return body
}

module.exports = { validateSettingsUpdate }
