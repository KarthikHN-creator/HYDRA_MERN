import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { Icon, StatusBadge } from './DashboardComponents.jsx'

const VOICE_SERVICE_URL = (import.meta.env.VITE_VOICE_SERVICE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '')

async function voiceRequest(path, method = 'GET') {
  const response = await fetch(`${VOICE_SERVICE_URL}${path}`, { method })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success) throw new Error(payload?.message || `Voice service request failed (${response.status})`)
  return payload.data
}

function VoiceControl({ onBack, systemStatus }) {
  const [voiceStatus, setVoiceStatus] = useState(null)
  const [voiceError, setVoiceError] = useState('')
  const [history, setHistory] = useState([])
  const [historyError, setHistoryError] = useState('')

  const refreshVoiceStatus = useCallback(async () => {
    try {
      const status = await voiceRequest('/status')
      setVoiceStatus(status)
      setVoiceError('')
    } catch (error) {
      setVoiceError(error.message)
      setVoiceStatus(null)
    }
  }, [])

  const refreshHistory = useCallback(async () => {
    try {
      const result = await api.commands({ page: 1, limit: 20 })
      setHistory(result.data.filter((record) => record.source === 'voice').slice(0, 5))
      setHistoryError('')
    } catch (error) {
      setHistoryError(error.message)
    }
  }, [])

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => refreshVoiceStatus(), 0)
    const timer = window.setInterval(() => {
      refreshVoiceStatus()
    }, 1500)
    return () => {
      window.clearTimeout(initialRefresh)
      window.clearInterval(timer)
    }
  }, [refreshVoiceStatus])

  const state = voiceStatus?.state || 'unavailable'
  const listening = ['loading_model', 'listening', 'stopping', 'recognizing'].includes(state)
  const latestResult = voiceStatus?.result
  const resultKey = latestResult ? `${latestResult.recognizedText}:${latestResult.backend?.status || latestResult.reason}` : ''

  useEffect(() => {
    const timer = window.setTimeout(() => refreshHistory(), 0)
    return () => window.clearTimeout(timer)
  }, [refreshHistory, resultKey])

  async function startListening() {
    try {
      setVoiceError('')
      await voiceRequest('/listen/start', 'POST')
      await refreshVoiceStatus()
    } catch (error) {
      setVoiceError(error.message)
    }
  }

  async function stopListening() {
    try {
      await voiceRequest('/listen/stop', 'POST')
      await refreshVoiceStatus()
    } catch (error) {
      setVoiceError(error.message)
    }
  }

  return (
    <section className="voice-screen" aria-labelledby="voice-title">
      <button className="back-link" type="button" onClick={onBack}><Icon name="back" size={17} /> Back to dashboard</button>

      <div className="manual-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow__line" /> ARM SYSTEM / VOICE CONTROL</div>
          <h1 id="voice-title">Voice <span>control</span></h1>
          <p className="intro-copy">Laptop microphone, local Whisper recognition, and approved action phrases.</p>
        </div>
        <div className="manual-connection">
          <StatusBadge tone={systemStatus.esp32.connected ? 'success' : 'muted'}>{systemStatus.esp32.connected ? 'ESP32 Connected' : 'ESP32 Disconnected'}</StatusBadge>
          <span>{voiceStatus ? 'Laptop voice service available' : 'Laptop voice service unavailable'}</span>
        </div>
      </div>

      <div className="voice-demo-notice" role="note">
        <Icon name="alert" size={17} />
        <p><strong>Local microphone service.</strong> Audio capture starts only after you press Start Listening. Unsupported or low-confidence speech is rejected; backend acceptance is not proof of movement.</p>
      </div>

      <div className={`voice-workspace${state === 'listening' ? ' voice-workspace--listening' : ''}`}>
        <div className="voice-workspace__eyebrow">VOICE INPUT</div>
        <div className={`mic-orbit${state === 'listening' ? ' mic-orbit--active' : ''}`} aria-hidden="true">
          <span className="mic-orbit__ring mic-orbit__ring--outer" />
          <span className="mic-orbit__ring mic-orbit__ring--inner" />
          <span className="mic-orbit__core"><Icon name="mic" size={31} /></span>
        </div>
        <div className="voice-status" aria-live="polite">
          <StatusBadge tone={state === 'listening' ? 'info' : state === 'error' || voiceError ? 'danger' : 'muted'}>{state.replaceAll('_', ' ')}</StatusBadge>
          <p>{voiceError || (state === 'idle' ? 'Microphone is inactive. Start listening only when ready.' : state === 'listening' ? 'Microphone capture is active until stopped or the eight-second clip limit.' : 'Voice service state is reported by the local laptop service.')}</p>
        </div>
        <div className="voice-actions">
          {!listening ? (
            <button className="voice-primary-button" type="button" onClick={startListening} disabled={!voiceStatus}><Icon name="mic" size={18} /> Start Listening</button>
          ) : (
            <button className="voice-stop-button" type="button" onClick={stopListening}><span className="voice-stop-button__square" /> Stop Listening</button>
          )}
        </div>
        <span className="voice-mode-label">LOCAL WHISPER · MICROPHONE REQUIRES EXPLICIT START</span>
      </div>

      <div className="voice-info-grid">
        <section className="voice-info-card" aria-labelledby="recognized-heading">
          <div className="voice-info-card__heading"><div><div className="section-kicker">LATEST INPUT</div><h2 id="recognized-heading">Recognized command</h2></div><span className="voice-info-card__icon"><Icon name="mic" size={17} /></span></div>
          <div className="recognized-empty" aria-live="polite">
            {latestResult ? <>
              <span className="recognized-empty__mark">{latestResult.accepted ? '✓' : '!'}</span>
              <strong>{latestResult.recognizedText || 'No clear phrase detected'}</strong>
              <p>{latestResult.accepted ? `${latestResult.action} · avg log probability ${Number(latestResult.avgLogprob).toFixed(2)}` : latestResult.reason}</p>
              {latestResult.backend && <p>Backend: {latestResult.backend.status}{latestResult.backend.error ? ` · ${latestResult.backend.error}` : ''}</p>}
            </> : <>
              <span className="recognized-empty__mark">—</span>
              <strong>No command detected</strong>
              <p>Only exact approved phrases pass matching and confidence checks.</p>
            </>}
          </div>
        </section>

        <section className="voice-info-card" aria-labelledby="history-heading">
          <div className="voice-info-card__heading"><div><div className="section-kicker">RECENT ACTIVITY</div><h2 id="history-heading">Command history</h2></div><span className="history-count">{history.length} ITEMS</span></div>
          {history.length ? <ul className="voice-history-list">{history.map((record) => <li key={record._id}><strong>{record.action}</strong><span>{record.status} · {new Date(record.createdAt).toLocaleTimeString()}</span></li>)}</ul> : <div className="history-empty"><span className="history-empty__icon"><Icon name="arrow" size={17} /></span><strong>{historyError ? 'History unavailable' : 'No voice command records'}</strong><p>{historyError || (voiceStatus ? 'Records appear after a backend command is stored.' : 'Connect the backend and start the local voice service.')}</p></div>}
        </section>
      </div>
    </section>
  )
}

export default VoiceControl
