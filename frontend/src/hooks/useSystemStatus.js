import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { connectRealtime } from '../services/realtime.js'

const initialStatus = {
  backend: { apiConnected: false, socketConnected: false, database: 'unknown' },
  esp32: { connected: null, status: 'unknown' },
  telemetry: { available: false, obstacleDetected: null, servoAngles: [null, null, null, null, null, null] },
}

export function useSystemStatus() {
  const [status, setStatus] = useState(initialStatus)

  useEffect(() => {
    let active = true
    let socketConnected = false
    const updateHealth = async () => {
      try {
        const [health, robot] = await Promise.all([api.health(), api.robotStatus()])
        if (!active) return
        setStatus({
          backend: { apiConnected: true, socketConnected, database: health.data.database.status },
          esp32: robot.data.esp32,
          telemetry: robot.data.telemetry,
        })
      } catch {
        if (!active) return
        setStatus({
          ...initialStatus,
          backend: { ...initialStatus.backend, socketConnected },
          esp32: { connected: null, status: 'unknown' },
        })
      }
    }

    const socket = connectRealtime()
    const onRobotStatus = (robot) => {
      if (!active) return
      setStatus((current) => ({ ...current, esp32: robot.esp32, telemetry: robot.telemetry }))
    }
    const onTelemetry = (telemetry) => {
      if (!active) return
      setStatus((current) => ({ ...current, telemetry: { ...telemetry, available: true } }))
    }
    const onSocketConnect = () => {
      socketConnected = true
      if (active) setStatus((current) => ({ ...current, backend: { ...current.backend, socketConnected: true } }))
    }
    const onSocketDisconnect = () => {
      socketConnected = false
      if (active) setStatus((current) => ({ ...current, backend: { ...current.backend, socketConnected: false } }))
    }

    socket.on('robot:status', onRobotStatus)
    socket.on('telemetry', onTelemetry)
    socket.on('connect', onSocketConnect)
    socket.on('disconnect', onSocketDisconnect)
    updateHealth()
    const timer = window.setInterval(updateHealth, 5000)

    return () => {
      active = false
      window.clearInterval(timer)
      socket.off('robot:status', onRobotStatus)
      socket.off('telemetry', onTelemetry)
      socket.off('connect', onSocketConnect)
      socket.off('disconnect', onSocketDisconnect)
    }
  }, [])

  return status
}
