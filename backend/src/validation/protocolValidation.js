const { isValidMessageId } = require('./messageId')

const ACTIONS = new Set(['MOVE_LEFT', 'MOVE_RIGHT', 'MOVE_UP', 'MOVE_DOWN', 'START', 'DRINK_WATER', 'STOP'])
const ACK_STATUSES = new Set(['accepted', 'rejected', 'completed', 'failed'])

function protocolError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function assertObject(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw protocolError('INVALID_MESSAGE', 'Message must be a JSON object')
  }
}

function assertExactFields(payload, expected) {
  const unknown = Object.keys(payload).filter((field) => !expected.includes(field))
  if (unknown.length) throw protocolError('UNKNOWN_FIELDS', `Unsupported field(s): ${unknown.join(', ')}`)
}

function validateCommandMessage(payload) {
  assertObject(payload)
  if (!isValidMessageId(payload.messageId)) {
    throw protocolError('INVALID_MESSAGE_ID', 'messageId must be 1–128 safe ASCII characters')
  }

  if (payload.type === 'servo') {
    assertExactFields(payload, ['type', 'messageId', 'servo', 'angle'])
    if (!Number.isInteger(payload.servo) || payload.servo < 1 || payload.servo > 6) {
      throw protocolError('INVALID_SERVO', 'servo must be an integer from 1 to 6')
    }
    if (typeof payload.angle !== 'number' || !Number.isFinite(payload.angle) || !Number.isInteger(payload.angle)) {
      throw protocolError('INVALID_ANGLE', 'angle must be a finite whole-degree number in this firmware build')
    }
    return payload
  }

  if (payload.type === 'action') {
    assertExactFields(payload, ['type', 'messageId', 'command'])
    if (typeof payload.command !== 'string' || !ACTIONS.has(payload.command)) {
      throw protocolError('UNSUPPORTED_ACTION', 'command is not a supported HYDRA action identifier')
    }
    return payload
  }

  throw protocolError('UNSUPPORTED_MESSAGE_TYPE', 'type must be servo or action')
}

function validateAcknowledgement(payload) {
  assertObject(payload)
  assertExactFields(payload, ['type', 'messageId', 'status', 'error'])
  if (payload.type !== 'ack' || !isValidMessageId(payload.messageId)) {
    throw protocolError('INVALID_ACK', 'ack requires a valid messageId')
  }
  if (!ACK_STATUSES.has(payload.status)) {
    throw protocolError('INVALID_ACK_STATUS', 'status must be accepted, rejected, completed, or failed')
  }
  if (payload.error !== null && typeof payload.error !== 'string') {
    throw protocolError('INVALID_ACK_ERROR', 'error must be a string or null')
  }
  return payload
}

function validateTelemetry(payload) {
  assertObject(payload)
  assertExactFields(payload, ['type', 'connected', 'obstacleDetected', 'servoAngles'])
  if (payload.type !== 'telemetry' || payload.connected !== true) {
    throw protocolError('INVALID_TELEMETRY', 'connected must be true for telemetry received from an active controller')
  }
  if (payload.obstacleDetected !== null && typeof payload.obstacleDetected !== 'boolean') {
    throw protocolError('INVALID_TELEMETRY', 'obstacleDetected must be true, false, or null')
  }
  if (!Array.isArray(payload.servoAngles) || payload.servoAngles.length !== 6) {
    throw protocolError('INVALID_TELEMETRY', 'servoAngles must contain exactly six entries')
  }
  if (payload.servoAngles.some((angle) => angle !== null && (typeof angle !== 'number' || !Number.isFinite(angle)))) {
    throw protocolError('INVALID_TELEMETRY', 'servoAngles entries must be finite numbers or null')
  }
  return payload
}

module.exports = { ACTIONS, validateCommandMessage, validateAcknowledgement, validateTelemetry, protocolError }
