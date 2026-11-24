const mongoose = require('mongoose')

const servoSchema = new mongoose.Schema({
  servoId: { type: Number, required: true, min: 1, max: 6 },
  name: { type: String, required: true, trim: true, minlength: 1 },
  minAngle: { type: Number, default: null },
  maxAngle: { type: Number, default: null },
  homeAngle: {
    type: Number,
    default: null,
    validate: { validator: (angle) => angle == null || Number.isInteger(angle), message: 'homeAngle must be a whole-degree number' },
  },
  calibrated: { type: Boolean, default: false },
}, { _id: false })

servoSchema.pre('validate', function validateCalibration(next) {
  if ((this.minAngle == null) !== (this.maxAngle == null)) {
    this.invalidate('minAngle', 'Both angle limits must be set together')
  }

  if (this.minAngle != null && this.maxAngle != null && this.minAngle >= this.maxAngle) {
    this.invalidate('maxAngle', 'maxAngle must be greater than minAngle')
  }

  if (this.calibrated && (this.minAngle == null || this.maxAngle == null)) {
    this.invalidate('calibrated', 'Angle limits must be configured before calibration')
  }

  if (this.homeAngle != null && (this.minAngle == null || this.maxAngle == null || this.homeAngle < this.minAngle || this.homeAngle > this.maxAngle)) {
    this.invalidate('homeAngle', 'homeAngle must be within the configured calibration limits')
  }

  next()
})

const defaultServos = Array.from({ length: 6 }, (_, index) => ({
  servoId: index + 1,
  name: `Servo ${index + 1}`,
  minAngle: null,
  maxAngle: null,
  homeAngle: null,
  calibrated: false,
}))

const servoConfigurationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: [true, 'userId is required'],
    trim: true,
    minlength: 1,
  },
  configurationName: { type: String, default: 'Default', trim: true, minlength: 1 },
  servos: {
    type: [servoSchema],
    default: defaultServos,
    validate: [
      {
        validator: (servos) => servos.length === 6,
        message: 'Exactly six servos must be configured',
      },
      {
        validator: (servos) => new Set(servos.map((servo) => servo.servoId)).size === servos.length,
        message: 'Servo IDs must be unique',
      },
    ],
  },
}, { timestamps: true })

servoConfigurationSchema.index({ userId: 1, configurationName: 1 }, { unique: true })

module.exports = mongoose.model('ServoConfiguration', servoConfigurationSchema)
