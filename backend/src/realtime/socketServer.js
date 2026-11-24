const crypto = require('node:crypto')
const { Server } = require('socket.io')
const mongoose = require('mongoose')
const CommandHistory = require('../models/CommandHistory')
const ServoConfiguration = require('../models/ServoConfiguration')
const { getDatabaseStatus } = require('../config/database')
const { validateServoTargetAgainstCalibration } = require('../validation/servoValidation')
const { isValidMessageId } = require('../validation/messageId')
const {
  validateCommandMessage,
  validateAcknowledgement,
  validateTelemetry,
  protocolError,
} = require('../validation/protocolValidation')

const pendingCommands = new Map()
const seenMessageIds = new Map()
const MAX_SEEN_MESSAGE_IDS = 10000
const ACK_TIMEOUT_MS = 30000

let ioInstance
let controllerSocketId = null
let latestTelemetry = null
let latestTelemetryAt = null
let calibrationLoader = null

function safeTokenEqual(expected, actual) {
  if (typeof expected !== 'string' || expected.length < 32 || typeof actual !== 'string') return false
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(actual)
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer)
}

function getRealtimeStatus() {
  return {
    esp32: {
      connected: Boolean(controllerSocketId),
      status: controllerSocketId ? 'connected' : 'disconnected',
    },
    telemetry: latestTelemetry
      ? { ...latestTelemetry, available: true, lastUpdatedAt: latestTelemetryAt }
      : {
          available: false,
          obstacleDetected: null,
          servoAngles: [null, null, null, null, null, null],
          lastUpdatedAt: null,
        },
  }
}

function broadcastStatus() {
  if (ioInstance) ioInstance.emit('robot:status', getRealtimeStatus())
}

function sendAck(socket, messageId, status, error = null) {
  const ack = { type: 'ack', messageId, status, error }
  socket.emit('ack', ack)
  return ack
}

function emitProtocolError(socket, error) {
  const message = { code: error.code || 'INVALID_MESSAGE', message: error.message || 'Invalid protocol message' }
  console.warn(`Socket protocol error from ${socket.id}: ${message.code} - ${message.message}`)
  socket.emit('protocol:error', message)
}

function markMessageId(messageId, payload) {
  seenMessageIds.set(messageId, JSON.stringify(payload))
  if (seenMessageIds.size > MAX_SEEN_MESSAGE_IDS) {
    seenMessageIds.delete(seenMessageIds.keys().next().value)
  }
}

async function saveCommandRecord(message, status, details) {
  if (mongoose.connection.readyState !== 1) return null
  if (!message || !isValidMessageId(message.messageId)) return null
  if (message.type === 'servo' && (!Number.isInteger(message.servo) || typeof message.angle !== 'number')) return null
  if (message.type === 'action' && typeof message.command !== 'string') return null
  if (!['servo', 'action'].includes(message.type)) return null
  const source = ['manual', 'voice', 'gesture', 'object-picking', 'system'].includes(message.source)
    ? message.source
    : 'manual'
  const values = message.type === 'servo'
    ? { action: 'set-angle', servoId: message.servo, requestedValue: message.angle }
    : { action: message.command }

  try {
    return await CommandHistory.create({
      messageId: message.messageId,
      userId: 'default',
      source,
      ...values,
      status,
      details,
    })
  } catch (error) {
    if (error.code === 11000) return null
    console.error(`Socket command history write failed: ${error.message}`)
    return null
  }
}

async function updateCommandStatus(messageId, status, details) {
  if (mongoose.connection.readyState !== 1) return
  const update = { status }
  if (details) update.details = details
  await CommandHistory.updateOne({ messageId }, { $set: update }).catch((error) => {
    console.error(`Socket command status write failed: ${error.message}`)
  })
}

function rejectCommand(socket, message, error) {
  if (message && isValidMessageId(message.messageId)) {
    console.warn(`Rejected socket command ${message.messageId}: ${error.code || 'REJECTED'} - ${error.message}`)
    sendAck(socket, message.messageId, 'rejected', `${error.code || 'REJECTED'}: ${error.message}`)
    saveCommandRecord(message, 'rejected', error.message)
  } else {
    emitProtocolError(socket, error)
  }
}

async function handleClientCommand(socket, rawMessage) {
  let message
  try {
    message = validateCommandMessage(rawMessage)
  } catch (error) {
    rejectCommand(socket, rawMessage, error)
    return
  }

  if (seenMessageIds.has(message.messageId)) {
    rejectCommand(socket, message, protocolError('DUPLICATE_MESSAGE_ID', 'messageId has already been used'))
    return
  }
  if (seenMessageIds.size >= MAX_SEEN_MESSAGE_IDS) {
    rejectCommand(socket, message, protocolError('MESSAGE_ID_CAPACITY', 'Command ID cache is full; restart the backend to accept new IDs'))
    return
  }
  markMessageId(message.messageId, message)
  if (mongoose.connection.readyState === 1 && await CommandHistory.exists({ messageId: message.messageId })) {
    rejectCommand(socket, message, protocolError('DUPLICATE_MESSAGE_ID', 'messageId has already been used'))
    return
  }

  if (message.type === 'servo') {
    try {
      let servo
      if (calibrationLoader) {
        servo = await calibrationLoader(message.servo)
      } else {
        if (!getDatabaseStatus().connected) throw protocolError('DATABASE_UNAVAILABLE', 'Servo calibration could not be verified')
        const configuration = await ServoConfiguration.findOne({ userId: 'default', configurationName: 'Default' })
        servo = configuration?.servos.find((item) => item.servoId === message.servo)
      }
      validateServoTargetAgainstCalibration(servo, message.angle)
    } catch (error) {
      rejectCommand(socket, message, error)
      return
    }
  }

  if (message.type === 'action' && message.command !== 'STOP') {
    rejectCommand(socket, message, protocolError('ACTION_BEHAVIOR_UNDEFINED', 'Action identifiers are approved, but physical behavior is not defined'))
    return
  }

  if (!controllerSocketId || !ioInstance?.sockets.sockets.has(controllerSocketId)) {
    rejectCommand(socket, message, protocolError('CONTROLLER_UNAVAILABLE', 'No authenticated controller is connected'))
    return
  }
  if (process.env.HYDRA_DEVICE_COMMANDS_ENABLED !== 'true') {
    rejectCommand(socket, message, protocolError('COMMANDS_DISABLED', 'Device command forwarding is disabled by configuration'))
    return
  }

  const controller = ioInstance.sockets.sockets.get(controllerSocketId)
  const enriched = { ...message, source: socket.data.source || 'manual' }
  await saveCommandRecord(enriched, 'pending', null)
  const timer = setTimeout(() => {
    const pending = pendingCommands.get(message.messageId)
    if (!pending) return
    pendingCommands.delete(message.messageId)
    sendAck(socket, message.messageId, 'failed', 'CONTROLLER_ACK_TIMEOUT: No controller acknowledgement arrived')
    updateCommandStatus(message.messageId, 'failed', 'Controller acknowledgement timed out')
  }, ACK_TIMEOUT_MS)
  pendingCommands.set(message.messageId, { socketId: socket.id, timer, message: enriched })

  sendAck(socket, message.messageId, 'accepted')
  controller.emit('command', message)
}

async function handleControllerAck(socket, rawAck) {
  if (socket.id !== controllerSocketId) return emitProtocolError(socket, protocolError('UNAUTHORIZED_ROLE', 'Only the active controller may send acknowledgements'))

  let ack
  try {
    ack = validateAcknowledgement(rawAck)
  } catch (error) {
    emitProtocolError(socket, error)
    return
  }

  const pending = pendingCommands.get(ack.messageId)
  if (!pending) {
    emitProtocolError(socket, protocolError('UNKNOWN_MESSAGE_ID', 'No pending command has this messageId'))
    return
  }

  const client = ioInstance.sockets.sockets.get(pending.socketId)
  if (client) client.emit('ack', ack)
  if (ack.status === 'accepted') return

  clearTimeout(pending.timer)
  pendingCommands.delete(ack.messageId)
  await updateCommandStatus(ack.messageId, ack.status, ack.error)
}

function handleControllerTelemetry(socket, rawTelemetry) {
  if (socket.id !== controllerSocketId) return emitProtocolError(socket, protocolError('UNAUTHORIZED_ROLE', 'Only the active controller may send telemetry'))
  try {
    latestTelemetry = validateTelemetry(rawTelemetry)
    latestTelemetryAt = new Date().toISOString()
    ioInstance.emit('telemetry', latestTelemetry)
    broadcastStatus()
  } catch (error) {
    emitProtocolError(socket, error)
  }
}

function failPendingForDisconnectedController() {
  for (const [messageId, pending] of pendingCommands.entries()) {
    clearTimeout(pending.timer)
    pendingCommands.delete(messageId)
    const client = ioInstance?.sockets.sockets.get(pending.socketId)
    if (client) sendAck(client, messageId, 'failed', 'CONTROLLER_DISCONNECTED: Command was not replayed')
    updateCommandStatus(messageId, 'failed', 'Controller disconnected; command was discarded and will not be replayed')
  }
}

function createSocketServer(httpServer, options = {}) {
  const allowedOrigins = (options.frontendOrigin || process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
    .split(',').map((origin) => origin.trim()).filter(Boolean)
  const server = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
    serveClient: false,
    pingInterval: 25000,
    pingTimeout: 20000,
  })
  ioInstance = server
  calibrationLoader = options.calibrationLoader || null

  server.use((socket, next) => {
    const role = socket.handshake.auth?.role || 'client'
    if (!['client', 'controller'].includes(role)) return next(new Error('Unsupported socket role'))
    const authorization = socket.handshake.headers.authorization || ''
    const headerToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : null
    const presentedToken = socket.handshake.auth?.token || headerToken
    if (role === 'controller' && !safeTokenEqual(options.deviceToken || process.env.HYDRA_DEVICE_TOKEN, presentedToken)) {
      console.warn(`Rejected controller socket authentication from ${socket.handshake.address || 'unknown address'}`)
      return next(new Error('Controller authentication failed'))
    }
    socket.data.role = role
    socket.data.source = ['manual', 'voice', 'gesture', 'object-picking', 'system'].includes(socket.handshake.auth?.source)
      ? socket.handshake.auth.source
      : 'manual'
    next()
  })

  server.on('connection', (socket) => {
    if (socket.data.role === 'controller') {
      if (controllerSocketId && controllerSocketId !== socket.id) {
        socket.disconnect(true)
        return
      }
      controllerSocketId = socket.id
      latestTelemetry = null
      latestTelemetryAt = null
      broadcastStatus()
    } else {
      socket.emit('robot:status', getRealtimeStatus())
    }

    socket.on('command', (message) => {
      if (socket.data.role !== 'client') return emitProtocolError(socket, protocolError('UNAUTHORIZED_ROLE', 'Only clients may submit commands'))
      handleClientCommand(socket, message).catch((error) => {
        console.error(`Socket command handler failed: ${error.message}`)
        rejectCommand(socket, message, protocolError('INTERNAL_ERROR', 'Command could not be processed'))
      })
    })

    socket.on('client:source', (source) => {
      if (socket.data.role !== 'client') return
      if (['manual', 'voice', 'gesture', 'object-picking', 'system'].includes(source)) {
        socket.data.source = source
      } else {
        emitProtocolError(socket, protocolError('INVALID_COMMAND_SOURCE', 'Unsupported command source'))
      }
    })

    socket.on('ack', (ack) => {
      handleControllerAck(socket, ack).catch((error) => {
        console.error(`Socket acknowledgement handler failed: ${error.message}`)
        emitProtocolError(socket, protocolError('INTERNAL_ERROR', 'Acknowledgement could not be processed'))
      })
    })

    socket.on('telemetry', (telemetry) => handleControllerTelemetry(socket, telemetry))

    socket.on('disconnect', (reason) => {
      console.info(`Socket client ${socket.id} disconnected: ${reason}`)
      if (socket.id === controllerSocketId) {
        controllerSocketId = null
        latestTelemetry = null
        latestTelemetryAt = null
        failPendingForDisconnectedController()
        broadcastStatus()
      }
    })
  })

  return server
}

module.exports = { createSocketServer, getRealtimeStatus }
