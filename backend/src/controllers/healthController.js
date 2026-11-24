const { getDatabaseStatus } = require('../config/database')
const { getRealtimeStatus } = require('../realtime/socketServer')

function getHealth(req, res) {
  res.json({
    success: true,
    data: {
      server: { status: 'running', uptimeSeconds: Math.floor(process.uptime()) },
      database: getDatabaseStatus(),
      esp32: getRealtimeStatus().esp32,
    },
    message: 'HYDRA backend is running',
  })
}

module.exports = { getHealth }
