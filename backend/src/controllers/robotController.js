const { getRealtimeStatus } = require('../realtime/socketServer')

function getRobotStatus(req, res) {
  res.json({ success: true, data: getRealtimeStatus() })
}

module.exports = { getRobotStatus }
