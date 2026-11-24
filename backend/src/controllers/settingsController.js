const UserSettings = require('../models/UserSettings')
const HttpError = require('../utils/HttpError')
const { getDatabaseStatus } = require('../config/database')
const { getUserId } = require('../validation/commonValidation')
const { validateSettingsUpdate } = require('../validation/settingsValidation')

function settingsData(document, userId) {
  return {
    userId,
    settings: document ? document.settings : {
      preferredControlMode: 'manual',
      theme: 'light',
      motionConfirmation: true,
    },
    updatedAt: document ? document.updatedAt : null,
  }
}

async function getSettings(req, res) {
  const userId = getUserId(req.query.userId)
  ensureDatabase()
  const document = await UserSettings.findOne({ userId })
  res.json({ success: true, data: settingsData(document, userId) })
}

async function updateSettings(req, res) {
  const body = { ...req.body }
  const userId = getUserId(req.query.userId || body.userId)
  delete body.userId
  const update = validateSettingsUpdate(body)
  ensureDatabase()
  let document = await UserSettings.findOne({ userId })
  if (!document) document = new UserSettings({ userId })
  document.settings = { ...document.settings, ...update }
  await document.save()
  res.json({ success: true, data: settingsData(document, userId) })
}

function ensureDatabase() {
  if (!getDatabaseStatus().connected) {
    throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'Database is not connected')
  }
}

module.exports = { getSettings, updateSettings }
