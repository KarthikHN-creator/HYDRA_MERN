const express = require('express')
const { getRobotStatus } = require('../controllers/robotController')

const router = express.Router()

router.get('/status', getRobotStatus)

module.exports = router
