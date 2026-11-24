require('dotenv').config()

const { createServer } = require('node:http')
const express = require('express')
const healthRoutes = require('./routes/healthRoutes')
const servoRoutes = require('./routes/servoRoutes')
const settingsRoutes = require('./routes/settingsRoutes')
const commandRoutes = require('./routes/commandRoutes')
const robotRoutes = require('./routes/robotRoutes')
const { connectDB } = require('./config/database')
const { createSocketServer } = require('./realtime/socketServer')
const notFoundHandler = require('./middleware/notFoundHandler')
const errorHandler = require('./middleware/errorHandler')

const app = express()
const port = process.env.PORT || 5000

const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',').map((origin) => origin.trim()).filter(Boolean)

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  return next()
})

app.use(express.json())
app.use('/api/health', healthRoutes)
app.use('/api/servos', servoRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/commands', commandRoutes)
app.use('/api/robot', robotRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

function startServer() {
  const server = createServer(app)
  createSocketServer(server)
  server.listen(port, () => {
    app.locals.serverStartedAt = Date.now()
    console.log(`HYDRA HTTP and Socket.IO server listening on port ${port}`)
    connectDB()
  })
  return server
}

if (require.main === module) startServer()

module.exports = { app, startServer }
