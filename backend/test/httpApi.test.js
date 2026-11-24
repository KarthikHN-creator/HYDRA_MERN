const assert = require('node:assert/strict')
const { after, before, test } = require('node:test')
const { createServer } = require('node:http')
const { app } = require('../src/server')

let httpServer
let baseUrl

async function request(path, { method = 'GET', body, rawBody } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body || rawBody ? { 'content-type': 'application/json' } : undefined,
    body: rawBody ?? (body ? JSON.stringify(body) : undefined),
  })
  return { status: response.status, json: await response.json() }
}

before(async () => {
  httpServer = createServer(app)
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()))
})

test('REST API returns truthful health, robot status, and database dependency responses', async () => {
  const health = await request('/api/health')
  assert.equal(health.status, 200)
  assert.equal(health.json.success, true)
  assert.equal(health.json.data.server.status, 'running')
  assert.equal(health.json.data.database.status, 'disconnected')

  const robot = await request('/api/robot/status')
  assert.equal(robot.status, 200)
  assert.equal(robot.json.data.esp32.connected, false)
  assert.equal(robot.json.data.telemetry.obstacleDetected, null)
  assert.deepEqual(robot.json.data.telemetry.servoAngles, [null, null, null, null, null, null])

  for (const path of ['/api/servos', '/api/servos/1', '/api/settings', '/api/commands?page=1&limit=10']) {
    const result = await request(path)
    assert.equal(result.status, 503, `${path} must report unavailable MongoDB`)
    assert.equal(result.json.error.code, 'DATABASE_UNAVAILABLE')
  }
})

test('REST API validates servo, setting, command, pagination, and JSON inputs before database access', async () => {
  const invalidServoNumber = await request('/api/servos/7')
  assert.equal(invalidServoNumber.status, 400)
  assert.equal(invalidServoNumber.json.error.code, 'INVALID_SERVO_NUMBER')

  const invalidServoUpdate = await request('/api/servos/1', { method: 'PATCH', body: { minAngle: 20 } })
  assert.equal(invalidServoUpdate.status, 400)

  const validServoUpdate = await request('/api/servos/1', { method: 'PATCH', body: { name: 'Test joint' } })
  assert.equal(validServoUpdate.status, 503)

  const invalidTarget = await request('/api/servos/1/target', { method: 'POST', body: { angle: '45' } })
  assert.equal(invalidTarget.status, 400)

  const validTargetWithoutDatabase = await request('/api/servos/1/target', { method: 'POST', body: { angle: 45 } })
  assert.equal(validTargetWithoutDatabase.status, 503)

  const invalidSettings = await request('/api/settings', { method: 'PATCH', body: { theme: 'sepia' } })
  assert.equal(invalidSettings.status, 400)
  const validSettingsWithoutDatabase = await request('/api/settings', { method: 'PATCH', body: { theme: 'dark' } })
  assert.equal(validSettingsWithoutDatabase.status, 503)

  const invalidPage = await request('/api/commands?page=0')
  assert.equal(invalidPage.status, 400)
  const invalidCommand = await request('/api/commands', { method: 'POST', body: { source: 'unknown', action: 'test' } })
  assert.equal(invalidCommand.status, 400)
  const validCommandWithoutDatabase = await request('/api/commands', { method: 'POST', body: { source: 'manual', action: 'preview' } })
  assert.equal(validCommandWithoutDatabase.status, 503)

  const malformedJson = await request('/api/settings', { method: 'PATCH', rawBody: '{' })
  assert.equal(malformedJson.status, 400)
  assert.equal(malformedJson.json.error.code, 'INVALID_JSON')

  const unknownRoute = await request('/api/not-real')
  assert.equal(unknownRoute.status, 404)
  assert.equal(unknownRoute.json.error.code, 'NOT_FOUND')
})
