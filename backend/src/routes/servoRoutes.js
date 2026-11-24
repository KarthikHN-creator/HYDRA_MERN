const express = require('express')
const { listServos, getServo, updateServo, recordServoTarget } = require('../controllers/servoController')

const router = express.Router()

router.get('/', listServos)
router.get('/:servoNumber', getServo)
router.patch('/:servoNumber', updateServo)
router.post('/:servoNumber/target', recordServoTarget)

module.exports = router
