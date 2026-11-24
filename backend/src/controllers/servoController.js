const ServoConfiguration = require('../models/ServoConfiguration')
const CommandHistory = require('../models/CommandHistory')
const HttpError = require('../utils/HttpError')
const { getDatabaseStatus } = require('../config/database')
const { getUserId, parseServoNumber } = require('../validation/commonValidation')
const {
  validateServoConfigurationUpdate,
  validateServoTarget,
  validateServoTargetAgainstCalibration,
} = require('../validation/servoValidation')

function ensureDatabase() {
  if (!getDatabaseStatus().connected) {
    throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'Database is not connected')
  }
}

async function getOrCreateConfiguration(userId) {
  let configuration = await ServoConfiguration.findOne({ userId, configurationName: 'Default' })
  if (configuration) return configuration

  try {
    configuration = new ServoConfiguration({ userId, configurationName: 'Default' })
    return await configuration.save()
  } catch (error) {
    if (error.code !== 11000) throw error
    return ServoConfiguration.findOne({ userId, configurationName: 'Default' })
  }
}

async function listServos(req, res) {
  const userId = getUserId(req.query.userId)
  ensureDatabase()
  const configuration = await getOrCreateConfiguration(userId)
  res.json({ success: true, data: configuration })
}

async function getServo(req, res) {
  const servoNumber = parseServoNumber(req.params.servoNumber)
  const userId = getUserId(req.query.userId)
  ensureDatabase()
  const configuration = await getOrCreateConfiguration(userId)
  const servo = configuration.servos.find((item) => item.servoId === servoNumber)
  if (!servo) throw new HttpError(404, 'SERVO_NOT_FOUND', 'Servo configuration was not found')
  res.json({ success: true, data: servo })
}

async function updateServo(req, res) {
  const servoNumber = parseServoNumber(req.params.servoNumber)
  const userId = getUserId(req.query.userId)
  const update = validateServoConfigurationUpdate(req.body)
  ensureDatabase()

  const configuration = await getOrCreateConfiguration(userId)
  const servo = configuration.servos.find((item) => item.servoId === servoNumber)
  if (!servo) throw new HttpError(404, 'SERVO_NOT_FOUND', 'Servo configuration was not found')

  if (Object.hasOwn(update, 'minAngle') || Object.hasOwn(update, 'maxAngle')) {
    if (update.calibrated !== true) update.calibrated = false
  }
  if (update.calibrated === true) {
    const minAngle = update.minAngle === undefined ? servo.minAngle : update.minAngle
    const maxAngle = update.maxAngle === undefined ? servo.maxAngle : update.maxAngle
    if (minAngle == null || maxAngle == null || minAngle >= maxAngle) {
      throw new HttpError(400, 'UNCALIBRATED_SERVO', 'Valid calibration limits are required before setting calibrated to true')
    }
  }

  const nextMinAngle = update.minAngle === undefined ? servo.minAngle : update.minAngle
  const nextMaxAngle = update.maxAngle === undefined ? servo.maxAngle : update.maxAngle
  const nextHomeAngle = update.homeAngle === undefined ? servo.homeAngle : update.homeAngle
  if (nextHomeAngle != null && (nextMinAngle == null || nextMaxAngle == null || nextHomeAngle < nextMinAngle || nextHomeAngle > nextMaxAngle)) {
    throw new HttpError(400, 'INVALID_HOME_ANGLE', 'homeAngle must be within the configured calibration limits')
  }

  Object.assign(servo, update)
  await configuration.save()
  res.json({ success: true, data: servo })
}

async function recordServoTarget(req, res) {
  const servoNumber = parseServoNumber(req.params.servoNumber)
  const userId = getUserId(req.query.userId)
  const angle = validateServoTarget(req.body)
  ensureDatabase()

  const configuration = await getOrCreateConfiguration(userId)
  const servo = configuration.servos.find((item) => item.servoId === servoNumber)
  if (!servo) throw new HttpError(404, 'SERVO_NOT_FOUND', 'Servo configuration was not found')
  validateServoTargetAgainstCalibration(servo, angle)

  const record = await CommandHistory.create({
    userId,
    source: 'manual',
    action: 'set-angle',
    servoId: servoNumber,
    requestedValue: angle,
    status: 'simulated',
    details: 'Validated target recorded only; no ESP32 command was sent',
  })
  res.status(201).json({ success: true, data: record, message: 'Target validated and recorded; not sent to hardware' })
}

module.exports = { listServos, getServo, updateServo, recordServoTarget }
