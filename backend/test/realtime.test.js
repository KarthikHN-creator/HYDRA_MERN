const assert = require('node:assert/strict')
const { after, before, test } = require('node:test')
const { createServer } = require('node:http')
const { io: createClient } = require('socket.io-client')
const { app } = require('../src/server')
const { createSocketServer } = require('../src/realtime/socketServer')

const deviceToken = 'test-only-device-secret-with-more-than-32-characters'
let httpServer
let socketServer
let baseUrl
let browser
let controller

function waitForEvent(socket, eventName, predicate = () => true, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, listener)
      reject(new Error(`Timed out waiting for ${eventName}`))
    }, timeoutMs)
    const listener = (payload) => {
      if (!predicate(payload)) return
      clearTimeout(timer)
      socket.off(eventName, listener)
      resolve(payload)
    }
    socket.on(eventName, listener)
  })
}

function createSocket(auth) {
  return createClient(baseUrl, { auth, transports: ['websocket'], reconnection: false, autoConnect: false })
}

function connectSocket(client) {
  return new Promise((resolve, reject) => {
    client.once('connect', resolve)
    client.once('connect_error', reject)
    client.connect()
  })
}

before(async () => {
  process.env.HYDRA_DEVICE_COMMANDS_ENABLED = 'true'
  httpServer = createServer(app)
  socketServer = createSocketServer(httpServer, {
    deviceToken,
    frontendOrigin: 'http://localhost:5173',
    // Synthetic fixture values used only by tests; these are not hardware calibration data.
    calibrationLoader: async (servo) => servo === 1
      ? { servoId: 1, calibrated: true, minAngle: 31.25, maxAngle: 72.5 }
      : null,
  })
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`
})

after(async () => {
  browser?.disconnect()
  controller?.disconnect()
  if (socketServer) await new Promise((resolve) => socketServer.close(resolve))
})

test('Socket.IO validates commands, relays acknowledgements, telemetry, and disconnect state', async (t) => {
  browser = createSocket({ role: 'client', source: 'manual' })
  const initialStatusPromise = waitForEvent(browser, 'robot:status')
  await connectSocket(browser)
  const initialStatus = await initialStatusPromise
  assert.equal(initialStatus.esp32.connected, false)
  assert.deepEqual(initialStatus.telemetry.servoAngles, [null, null, null, null, null, null])

  const invalidServoAckPromise = waitForEvent(browser, 'ack', (ack) => ack.messageId === 'invalid-servo')
  browser.emit('command', { type: 'servo', messageId: 'invalid-servo', servo: 7, angle: 45 })
  const invalidServoAck = await invalidServoAckPromise
  assert.equal(invalidServoAck.status, 'rejected')
  assert.match(invalidServoAck.error, /INVALID_SERVO/)

  const unknownActionAckPromise = waitForEvent(browser, 'ack', (ack) => ack.messageId === 'unknown-action')
  browser.emit('command', { type: 'action', messageId: 'unknown-action', command: 'WAVE' })
  assert.equal((await unknownActionAckPromise).status, 'rejected')

  const unauthenticatedController = createSocket({ role: 'controller' })
  const authErrorPromise = new Promise((resolve) => unauthenticatedController.once('connect_error', resolve))
  unauthenticatedController.connect()
  const authError = await authErrorPromise
  assert.match(authError.message, /authentication failed/i)
  unauthenticatedController.close()

  const connectedStatusPromise = waitForEvent(browser, 'robot:status', (status) => status.esp32.connected)
  controller = createSocket({ role: 'controller', token: deviceToken })
  await connectSocket(controller)
  const connectedStatus = await connectedStatusPromise
  assert.equal(connectedStatus.esp32.status, 'connected')

  const controllerCommandPromise = waitForEvent(controller, 'command', (message) => message.messageId === 'servo-in-range')
  const firstAckPromise = waitForEvent(browser, 'ack', (ack) => ack.messageId === 'servo-in-range' && ack.status === 'accepted')
  browser.emit('command', { type: 'servo', messageId: 'servo-in-range', servo: 1, angle: 45 })
  const controllerCommand = await controllerCommandPromise
  assert.equal(controllerCommand.angle, 45)
  await firstAckPromise

  const completedAckPromise = waitForEvent(browser, 'ack', (ack) => ack.messageId === 'servo-in-range' && ack.status === 'completed')
  controller.emit('ack', { type: 'ack', messageId: 'servo-in-range', status: 'completed', error: null })
  assert.equal((await completedAckPromise).status, 'completed')

  const rangeAckPromise = waitForEvent(browser, 'ack', (ack) => ack.messageId === 'servo-out-of-range')
  browser.emit('command', { type: 'servo', messageId: 'servo-out-of-range', servo: 1, angle: 90 })
  const rangeAck = await rangeAckPromise
  assert.equal(rangeAck.status, 'rejected')
  assert.match(rangeAck.error, /ANGLE_OUT_OF_RANGE/)

  const telemetry = {
    type: 'telemetry',
    connected: true,
    obstacleDetected: null,
    servoAngles: [null, null, null, null, null, null],
  }
  const telemetryPromise = waitForEvent(browser, 'telemetry')
  controller.emit('telemetry', telemetry)
  assert.deepEqual(await telemetryPromise, telemetry)
  const statusResponse = await fetch(`${baseUrl}/api/robot/status`)
  const robotStatus = await statusResponse.json()
  assert.equal(robotStatus.data.esp32.connected, true)
  assert.equal(robotStatus.data.telemetry.obstacleDetected, null)
  assert.deepEqual(robotStatus.data.telemetry.servoAngles, telemetry.servoAngles)

  const pendingAckPromise = waitForEvent(browser, 'ack', (ack) => ack.messageId === 'discard-on-disconnect' && ack.status === 'accepted')
  const pendingCommandPromise = waitForEvent(controller, 'command', (message) => message.messageId === 'discard-on-disconnect')
  browser.emit('command', { type: 'action', messageId: 'discard-on-disconnect', command: 'STOP' })
  await Promise.all([pendingAckPromise, pendingCommandPromise])

  const disconnectFailurePromise = waitForEvent(browser, 'ack', (ack) => ack.messageId === 'discard-on-disconnect' && ack.status === 'failed')
  const disconnectedStatusPromise = waitForEvent(browser, 'robot:status', (status) => !status.esp32.connected)
  controller.disconnect()
  const disconnectFailure = await disconnectFailurePromise
  assert.match(disconnectFailure.error, /not replayed/i)
  controller = null

  const disconnectedStatus = await disconnectedStatusPromise
  assert.equal(disconnectedStatus.telemetry.available, false)
  assert.deepEqual(disconnectedStatus.telemetry.servoAngles, [null, null, null, null, null, null])

  await t.test('health reports server, database, and controller state', async () => {
    const response = await fetch(`${baseUrl}/api/health`)
    const health = await response.json()
    assert.equal(response.status, 200)
    assert.equal(health.data.server.status, 'running')
    assert.equal(typeof health.data.database.connected, 'boolean')
    assert.equal(health.data.esp32.connected, false)
  })
})
