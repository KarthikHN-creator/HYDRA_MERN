const express = require('express')
const { createCommand, listCommands } = require('../controllers/commandController')

const router = express.Router()

router.get('/', listCommands)
router.post('/', createCommand)

module.exports = router
