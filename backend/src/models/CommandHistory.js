const mongoose = require('mongoose')

const commandHistorySchema = new mongoose.Schema({
  messageId: { type: String, trim: true, maxlength: 128 },
  userId: { type: String, trim: true, minlength: 1 },
  source: {
    type: String,
    required: true,
    enum: ['manual', 'voice', 'gesture', 'object-picking', 'system'],
  },
  action: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
  servoId: {
    type: Number,
    default: null,
    validate: {
      validator: (value) => value == null || Number.isInteger(value) && value >= 1 && value <= 6,
      message: 'servoId must be an integer from 1 to 6',
    },
  },
  requestedValue: { type: Number, default: null },
  status: {
    type: String,
    enum: ['simulated', 'pending', 'rejected', 'completed', 'failed'],
    default: 'simulated',
  },
  details: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true })

commandHistorySchema.index({ createdAt: -1 })
commandHistorySchema.index({ messageId: 1 }, { unique: true, sparse: true })

module.exports = mongoose.model('CommandHistory', commandHistorySchema)
