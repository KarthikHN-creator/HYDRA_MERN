import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'
let socket

export function getRealtimeSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 5000,
      auth: { role: 'client', source: 'manual' },
    })
  }
  return socket
}

export function connectRealtime() {
  const client = getRealtimeSocket()
  if (!client.connected) client.connect()
  return client
}

export function sendProtocolCommand(command, source = 'manual', onAcknowledgement = () => {}) {
  const client = connectRealtime()
  if (!client.connected) throw new Error('Realtime backend is disconnected')
  client.emit('client:source', source)
  const cleanup = () => {
    client.off('ack', onAck)
    client.off('disconnect', onDisconnect)
  }
  const onAck = (ack) => {
    if (ack.messageId !== command.messageId) return
    onAcknowledgement(ack)
    if (['rejected', 'completed', 'failed'].includes(ack.status)) cleanup()
  }
  const onDisconnect = () => {
    onAcknowledgement({
      type: 'ack', messageId: command.messageId, status: 'failed',
      error: 'REALTIME_DISCONNECTED: Acknowledgement unavailable; command will not be retried',
    })
    cleanup()
  }
  client.on('ack', onAck)
  client.on('disconnect', onDisconnect)
  client.emit('command', command)
  return command.messageId
}

export function createMessageId() {
  if (globalThis.crypto?.randomUUID) return `cmd-${globalThis.crypto.randomUUID()}`
  return `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}
