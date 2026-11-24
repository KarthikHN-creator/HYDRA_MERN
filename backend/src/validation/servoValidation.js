const HttpError = require('../utils/HttpError')
const { parseFiniteNumber, rejectUnknownFields } = require('./commonValidation')

function validateServoConfigurationUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object')
  }

  const allowed = ['name', 'minAngle', 'maxAngle', 'homeAngle', 'calibrated']
  rejectUnknownFields(body, allowed)
  if (Object.keys(body).length === 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Provide at least one servo configuration field')
  }

  const update = {}
  if (Object.hasOwn(body, 'name')) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 80) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'name must be a non-empty string up to 80 characters')
    }
    update.name = body.name.trim()
  }

  for (const field of ['minAngle', 'maxAngle', 'homeAngle']) {
    if (Object.hasOwn(body, field)) {
      update[field] = body[field] === null ? null : parseFiniteNumber(body[field], field)
    }
  }

  if (Object.hasOwn(body, 'calibrated')) {
    if (typeof body.calibrated !== 'boolean') {
      throw new HttpError(400, 'VALIDATION_ERROR', 'calibrated must be a boolean')
    }
    update.calibrated = body.calibrated
  }

  if (Object.hasOwn(update, 'minAngle') !== Object.hasOwn(update, 'maxAngle')) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'minAngle and maxAngle must be provided together')
  }
  if (update.minAngle != null && update.maxAngle != null && update.minAngle >= update.maxAngle) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'maxAngle must be greater than minAngle')
  }
  if (update.homeAngle != null && !Number.isInteger(update.homeAngle)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'homeAngle must be a whole-degree number')
  }
  if (update.homeAngle != null && update.minAngle != null && update.maxAngle != null && (update.homeAngle < update.minAngle || update.homeAngle > update.maxAngle)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'homeAngle must be within the configured calibration limits')
  }
  if (update.calibrated === true && (update.minAngle === null || update.maxAngle === null)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Calibration limits cannot be null for a calibrated servo')
  }

  return update
}

function validateServoTarget(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object')
  }
  rejectUnknownFields(body, ['angle'])
  const angle = parseFiniteNumber(body.angle, 'angle')
  if (!Number.isInteger(angle)) throw new HttpError(400, 'VALIDATION_ERROR', 'angle must be a whole-degree number')
  return angle
}

function validateServoTargetAgainstCalibration(servo, angle) {
  if (!servo || !servo.calibrated || servo.minAngle == null || servo.maxAngle == null) {
    throw new HttpError(409, 'UNCALIBRATED_SERVO', 'Servo movement configuration is unavailable until calibration limits are set')
  }
  if (angle < servo.minAngle || angle > servo.maxAngle) {
    throw new HttpError(400, 'ANGLE_OUT_OF_RANGE', `angle must be between configured limits ${servo.minAngle} and ${servo.maxAngle}`)
  }
}

module.exports = { validateServoConfigurationUpdate, validateServoTarget, validateServoTargetAgainstCalibration }
