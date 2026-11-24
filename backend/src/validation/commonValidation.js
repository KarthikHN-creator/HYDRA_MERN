const HttpError = require('../utils/HttpError')

function getUserId(value) {
  if (value === undefined || value === '') return 'default'
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > 100) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'userId must be a non-empty string up to 100 characters')
  }
  return value.trim()
}

function parseServoNumber(value) {
  if (!/^[1-6]$/.test(String(value))) {
    throw new HttpError(400, 'INVALID_SERVO_NUMBER', 'servoNumber must be an integer from 1 to 6')
  }
  return Number(value)
}

function parseFiniteNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${field} must be a finite number`)
  }
  return value
}

function rejectUnknownFields(body, allowedFields) {
  const unknown = Object.keys(body).filter((field) => !allowedFields.includes(field))
  if (unknown.length) {
    throw new HttpError(400, 'UNKNOWN_FIELDS', `Unknown field(s): ${unknown.join(', ')}`)
  }
}

module.exports = { getUserId, parseServoNumber, parseFiniteNumber, rejectUnknownFields }
