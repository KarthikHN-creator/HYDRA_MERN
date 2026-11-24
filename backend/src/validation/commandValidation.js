const HttpError = require('../utils/HttpError')
const { parseFiniteNumber, rejectUnknownFields } = require('./commonValidation')

const sources = ['manual', 'voice', 'gesture', 'object-picking', 'system']

function validateCommand(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object')
  }
  rejectUnknownFields(body, ['userId', 'source', 'action', 'servoId', 'requestedValue', 'details'])
  if (!sources.includes(body.source)) {
    throw new HttpError(400, 'VALIDATION_ERROR', `source must be one of: ${sources.join(', ')}`)
  }
  if (typeof body.action !== 'string' || !body.action.trim() || body.action.trim().length > 200) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'action must be a non-empty string up to 200 characters')
  }

  const command = { source: body.source, action: body.action.trim(), status: 'simulated' }
  if (Object.hasOwn(body, 'userId')) {
    if (typeof body.userId !== 'string' || !body.userId.trim() || body.userId.trim().length > 100) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'userId must be a non-empty string up to 100 characters')
    }
    command.userId = body.userId.trim()
  } else {
    command.userId = 'default'
  }

  if (Object.hasOwn(body, 'servoId')) {
    if (!Number.isInteger(body.servoId) || body.servoId < 1 || body.servoId > 6) {
      throw new HttpError(400, 'INVALID_SERVO_NUMBER', 'servoId must be an integer from 1 to 6')
    }
    command.servoId = body.servoId
  }
  if (Object.hasOwn(body, 'requestedValue')) {
    command.requestedValue = parseFiniteNumber(body.requestedValue, 'requestedValue')
  }
  if (Object.hasOwn(body, 'details')) {
    if (typeof body.details !== 'string' || body.details.length > 500) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'details must be a string up to 500 characters')
    }
    command.details = body.details
  }

  if (command.action === 'set-angle' && (command.servoId === undefined || command.requestedValue === undefined)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'set-angle commands require servoId and requestedValue')
  }
  if (command.action === 'set-angle' && !Number.isInteger(command.requestedValue)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'set-angle requestedValue must be a whole-degree number')
  }
  return command
}

function validatePagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page)
  const limit = query.limit === undefined ? 20 : Number(query.limit)
  if (!Number.isInteger(page) || page < 1) {
    throw new HttpError(400, 'INVALID_PAGINATION', 'page must be a positive integer')
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpError(400, 'INVALID_PAGINATION', 'limit must be an integer from 1 to 100')
  }
  return { page, limit }
}

module.exports = { validateCommand, validatePagination }
