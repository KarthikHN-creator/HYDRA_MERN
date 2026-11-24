const mongoose = require('mongoose')

const userSettingsSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: [true, 'userId is required'],
    trim: true,
    unique: true,
    minlength: 1,
  },
  settings: {
    preferredControlMode: {
      type: String,
      enum: ['manual', 'voice', 'gesture', 'object-picking'],
      default: 'manual',
    },
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    motionConfirmation: { type: Boolean, default: true },
  },
}, { timestamps: true })

module.exports = mongoose.model('UserSettings', userSettingsSchema)
