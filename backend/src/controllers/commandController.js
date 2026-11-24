const CommandHistory = require('../models/CommandHistory')
const ServoConfiguration = require('../models/ServoConfiguration')
const HttpError = require('../utils/HttpError')
const { getDatabaseStatus } = require('../config/database')
const { getUserId } = require('../validation/commonValidation')
const { validateCommand, validatePagination } = require('../validation/commandValidation')
const { validateServoTargetAgainstCalibration } = require('../validation/servoValidation')

function ensureDatabase() {
  if (!getDatabaseStatus().connected) {
    throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'Database is not connected')
  }
}

async function createCommand(req, res) {
  const command = validateCommand(req.body)
  ensureDatabase()

  if (command.action === 'set-angle') {
    const configuration = await ServoConfiguration.findOne({ userId: command.userId, configurationName: 'Default' })
    const servo = configuration?.servos.find((item) => item.servoId === command.servoId)
    validateServoTargetAgainstCalibration(servo, command.requestedValue)
    command.details = [command.details, 'Validated target recorded only; no ESP32 command was sent'].filter(Boolean).join(' ')
  }

  const record = await CommandHistory.create(command)
  res.status(201).json({ success: true, data: record, message: 'Command record saved as simulated; no hardware action was performed' })
}

async function listCommands(req, res) {
  const { page, limit } = validatePagination(req.query)
  const userId = getUserId(req.query.userId)
  ensureDatabase()

  const filter = { userId }
  const [records, totalRecords] = await Promise.all([
    CommandHistory.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    CommandHistory.countDocuments(filter),
  ])

  res.json({
    success: true,
    data: records,
    pagination: { page, limit, totalRecords, totalPages: Math.ceil(totalRecords / limit) },
  })
}

module.exports = { createCommand, listCommands }
