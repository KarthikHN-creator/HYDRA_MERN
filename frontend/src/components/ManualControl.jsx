import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api.js'
import { createMessageId, sendProtocolCommand } from '../services/realtime.js'
import { Icon, StatusBadge } from './DashboardComponents.jsx'
import ServoControl from './ServoControl.jsx'

const servoLayout = [
  { number: 1, gpio: 13, name: 'Base rotation' },
  { number: 2, gpio: 14, name: 'Shoulder' },
  { number: 3, gpio: 25, name: 'Elbow' },
  { number: 4, gpio: 26, name: 'Wrist pitch' },
  { number: 5, gpio: 27, name: 'Wrist rotation' },
  { number: 6, gpio: 32, name: 'Gripper' },
]

const emptyServo = (item) => ({
  servoId: item.number,
  name: item.name,
  minAngle: null,
  maxAngle: null,
  homeAngle: null,
  calibrated: false,
})

function makeCalibrationDraft(servo) {
  return {
    minAngle: servo.minAngle ?? '',
    maxAngle: servo.maxAngle ?? '',
    homeAngle: servo.homeAngle ?? '',
    calibrated: servo.calibrated,
  }
}

function ManualControl({ onBack, systemStatus }) {
  const [servoConfigs, setServoConfigs] = useState(() => servoLayout.map(emptyServo))
  const [targetAngles, setTargetAngles] = useState(() => servoLayout.map(() => null))
  const [calibrationDrafts, setCalibrationDrafts] = useState({})
  const [motionConfirmation, setMotionConfirmation] = useState(true)
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(true)
  const [configurationMessage, setConfigurationMessage] = useState('Loading servo configuration…')
  const [saveMessages, setSaveMessages] = useState({})
  const [commandMessages, setCommandMessages] = useState({})
  const [workflowMessage, setWorkflowMessage] = useState('')

  useEffect(() => {
    let active = true
    Promise.allSettled([api.servos(), api.settings()]).then(([servoResult, settingsResult]) => {
      if (!active) return
      if (servoResult.status === 'fulfilled') {
        const serverServos = servoResult.value.data.servos
        const mapped = servoLayout.map((layout) => {
          const saved = serverServos.find((servo) => servo.servoId === layout.number)
          return { ...emptyServo(layout), ...saved, number: layout.number, gpio: layout.gpio }
        })
        setServoConfigs(mapped)
        setTargetAngles(mapped.map((servo) => servo.homeAngle ?? null))
        setCalibrationDrafts(Object.fromEntries(mapped.map((servo) => [servo.servoId, makeCalibrationDraft(servo)])))
        setConfigurationMessage('Configuration loaded from MongoDB')
      } else {
        setConfigurationMessage(`Servo configuration unavailable: ${servoResult.reason.message}`)
      }
      if (settingsResult.status === 'fulfilled') {
        setMotionConfirmation(settingsResult.value.data.settings.motionConfirmation)
      }
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const controlReady = systemStatus.backend.apiConnected
    && systemStatus.backend.socketConnected
    && systemStatus.backend.database === 'connected'
    && systemStatus.esp32.connected === true
  const allHomeConfigured = servoConfigs.length === 6 && servoConfigs.every((servo) => (
    servo.calibrated && servo.minAngle != null && servo.maxAngle != null
    && servo.homeAngle != null && servo.homeAngle >= servo.minAngle && servo.homeAngle <= servo.maxAngle
  ))
  const connectionText = useMemo(() => {
    if (!systemStatus.backend.apiConnected) return 'Backend API unavailable'
    if (!systemStatus.backend.socketConnected) return 'Realtime connection unavailable'
    if (systemStatus.backend.database !== 'connected') return 'Database unavailable; calibration cannot be verified'
    if (systemStatus.esp32.connected !== true) return 'Controller disconnected'
    return 'Controller connected; requests still require server approval'
  }, [systemStatus])

  function changeTarget(index, angle) {
    setTargetAngles((current) => current.map((value, itemIndex) => itemIndex === index ? angle : value))
  }

  function onCommandAck(servoNumber, ack) {
    const message = ack.status === 'accepted'
      ? 'Accepted by backend; awaiting controller result. No position is implied.'
      : `${ack.status}: ${ack.error || 'Controller response received; no independent position feedback.'}`
    setCommandMessages((current) => ({ ...current, [servoNumber]: message }))
  }

  function sendServoTarget(servoNumber) {
    const servo = servoConfigs.find((item) => item.servoId === servoNumber)
    const angle = targetAngles[servoNumber - 1]
    if (!controlReady || paused || !servo?.calibrated || !Number.isFinite(angle)) return
    if (motionConfirmation && !window.confirm(`Request servo ${servoNumber} target ${angle}°?`)) return

    const command = { type: 'servo', messageId: createMessageId(), servo: servoNumber, angle }
    try {
      setCommandMessages((current) => ({ ...current, [servoNumber]: 'Sending validated target request…' }))
      sendProtocolCommand(command, 'manual', (ack) => onCommandAck(servoNumber, ack))
    } catch (error) {
      setCommandMessages((current) => ({ ...current, [servoNumber]: error.message }))
    }
  }

  async function sendHomeSequence() {
    if (!controlReady || paused || !allHomeConfigured) return
    if (motionConfirmation && !window.confirm('Send the six configured home targets one at a time? Controller completion does not verify physical position.')) return

    setWorkflowMessage('Sending the configured home sequence…')
    for (const servo of servoConfigs) {
      const command = {
        type: 'servo',
        messageId: createMessageId(),
        servo: servo.servoId,
        angle: servo.homeAngle,
      }
      const outcome = await new Promise((resolve) => {
        let settled = false
        const timeout = window.setTimeout(() => {
          if (!settled) resolve({ status: 'failed', error: 'Acknowledgement timed out; remaining targets were not sent.' })
        }, 32000)
        try {
          sendProtocolCommand(command, 'manual', (ack) => {
            if (ack.status === 'accepted') {
              setWorkflowMessage(`Servo ${servo.servoId} request accepted; waiting for controller acknowledgement…`)
            }
            if (['completed', 'rejected', 'failed'].includes(ack.status) && !settled) {
              settled = true
              window.clearTimeout(timeout)
              resolve(ack)
            }
          })
        } catch (error) {
          settled = true
          window.clearTimeout(timeout)
          resolve({ status: 'failed', error: error.message })
        }
      })
      if (outcome.status !== 'completed') {
        setWorkflowMessage(`Home sequence stopped at servo ${servo.servoId}: ${outcome.error || outcome.status}. Later targets were not sent.`)
        return
      }
      setWorkflowMessage(`Controller reported command processing complete for servo ${servo.servoId}; this is not physical position feedback.`)
    }
    setWorkflowMessage('Controller reported processing complete for all six requests; physical positions remain unverified.')
  }

  function sendStopRequest() {
    setPaused(true)
    setWorkflowMessage('Local controls paused. Sending a software STOP request; this is not a physical emergency stop.')
    try {
      sendProtocolCommand({ type: 'action', messageId: createMessageId(), command: 'STOP' }, 'manual', (ack) => {
        setWorkflowMessage(ack.status === 'accepted'
          ? 'STOP request accepted by backend; this does not confirm that physical motion stopped.'
          : `STOP request ${ack.status}: ${ack.error || 'no physical stop is confirmed'}`)
      })
    } catch (error) {
      setWorkflowMessage(`Local controls paused. STOP request was not sent: ${error.message}`)
    }
  }

  async function saveCalibration(servoNumber) {
    const draft = calibrationDrafts[servoNumber]
    if (!draft) return
    setSaveMessages((current) => ({ ...current, [servoNumber]: 'Saving…' }))
    const asNumberOrNull = (value) => value === '' ? null : Number(value)
    const update = {
      minAngle: asNumberOrNull(draft.minAngle),
      maxAngle: asNumberOrNull(draft.maxAngle),
      homeAngle: asNumberOrNull(draft.homeAngle),
      calibrated: draft.calibrated,
    }
    if (Object.values(update).some((value) => typeof value === 'number' && !Number.isFinite(value))) {
      setSaveMessages((current) => ({ ...current, [servoNumber]: 'Enter finite numeric calibration values.' }))
      return
    }
    try {
      const result = await api.updateServo(servoNumber, update)
      const saved = result.data
      setServoConfigs((current) => current.map((servo) => servo.servoId === servoNumber ? { ...servo, ...saved } : servo))
      setCalibrationDrafts((current) => ({ ...current, [servoNumber]: makeCalibrationDraft(saved) }))
      setSaveMessages((current) => ({ ...current, [servoNumber]: 'Calibration configuration saved.' }))
    } catch (error) {
      setSaveMessages((current) => ({ ...current, [servoNumber]: error.message }))
    }
  }

  return (
    <section className="manual-screen" aria-labelledby="manual-title">
      <button className="back-link" type="button" onClick={onBack}><Icon name="back" size={17} /> Back to dashboard</button>

      <div className="manual-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow__line" /> ARM SYSTEM / MANUAL CONTROL</div>
          <h1 id="manual-title">Manual <span>control</span></h1>
          <p className="intro-copy">Choose a target within the configured calibration limits, then explicitly send the request.</p>
        </div>
        <div className="manual-connection">
          <StatusBadge tone={systemStatus.esp32.connected ? 'success' : 'muted'}>{systemStatus.esp32.connected ? 'ESP32 Connected' : 'ESP32 Disconnected'}</StatusBadge>
          <span>{connectionText}</span>
        </div>
      </div>

      <div className="preview-notice" role="note">
        <span className="preview-notice__icon"><Icon name="alert" size={18} /></span>
        <div><strong>Safety gate</strong><p>Targets are sent only after an explicit action and must pass server calibration checks. Servo power and physical safety have not been verified. A software STOP request is not a physical emergency stop.</p></div>
      </div>

      <div className="servo-section-heading">
        <div><div className="section-kicker">CALIBRATED JOINT TARGETS</div><h2>Servo channels</h2></div>
        <span className="channel-count">6 CONFIGURABLE CHANNELS</span>
      </div>
      {loading && <p className="manual-disclaimer">{configurationMessage}</p>}
      {!loading && !servoConfigs.some((servo) => servo.minAngle != null) && <p className="manual-disclaimer">{configurationMessage}. Enter mechanically verified limits below before enabling a servo.</p>}

      <div className="servo-grid" aria-label="Servo target controls">
        {servoLayout.map((layout, index) => {
          const servo = { ...layout, ...servoConfigs[index] }
          const draft = calibrationDrafts[servo.servoId] || makeCalibrationDraft(servo)
          const rangeInputs = ['minAngle', 'maxAngle', 'homeAngle']
          return (
            <div className="servo-config-group" key={layout.number}>
              <ServoControl
                servo={servo}
                angle={targetAngles[index]}
                disabled={paused}
                commandDisabled={!controlReady || !servo.calibrated || loading}
                commandStatus={commandMessages[servo.servoId]}
                onChange={changeTarget}
                onSend={sendServoTarget}
              />
              <details className="servo-calibration">
                <summary>Calibration and home settings</summary>
                <p>Only enter limits measured for this physical joint. No default range is assumed.</p>
                <div className="servo-calibration__fields">
                  {rangeInputs.map((field) => (
                    <label key={field}>{field === 'homeAngle' ? 'Home angle' : `${field === 'minAngle' ? 'Minimum' : 'Maximum'} angle`}
                      <input type="number" step="any" value={draft[field]} onChange={(event) => setCalibrationDrafts((current) => ({ ...current, [servo.servoId]: { ...draft, [field]: event.target.value, calibrated: field === 'homeAngle' ? draft.calibrated : false } }))} />
                    </label>
                  ))}
                </div>
                <label className="settings-checkbox"><input type="checkbox" checked={draft.calibrated} onChange={(event) => setCalibrationDrafts((current) => ({ ...current, [servo.servoId]: { ...draft, calibrated: event.target.checked } }))} /> Mark as mechanically calibrated</label>
                <button type="button" className="action-button" disabled={!systemStatus.backend.apiConnected || systemStatus.backend.database !== 'connected'} onClick={() => saveCalibration(servo.servoId)}>Save configuration</button>
                {saveMessages[servo.servoId] && <span className="servo-command-status" role="status">{saveMessages[servo.servoId]}</span>}
              </details>
            </div>
          )
        })}
      </div>

      <div className={`control-action-bar${paused ? ' control-action-bar--paused' : ''}`}>
        <div className="control-action-bar__state">
          <span className={`state-indicator${paused ? ' state-indicator--paused' : ''}`} />
          <div><strong>{paused ? 'Local controls paused' : 'Controller gated'}</strong><span>{paused ? 'Resume only reenables this UI; it does not clear a controller fault.' : connectionText}</span></div>
        </div>
        <div className="control-buttons">
          <button className="action-button action-button--home" type="button" onClick={sendHomeSequence} disabled={!controlReady || paused || loading || !allHomeConfigured}><Icon name="home" size={15} /> Home All</button>
          <button className="action-button action-button--stop" type="button" onClick={sendStopRequest} disabled={paused}><Icon name="alert" size={15} /> Stop <small>software request</small></button>
          <button className="action-button action-button--resume" type="button" onClick={() => { setPaused(false); setWorkflowMessage('Local controls resumed. No hardware resume command exists in the agreed protocol.') }} disabled={!paused}>Resume UI</button>
        </div>
      </div>
      {workflowMessage && <p className="manual-disclaimer" role="status">{workflowMessage}</p>}
      <p className="manual-disclaimer">Home All requires six individually calibrated home angles and sends one request at a time. Resume UI only clears the local pause. No action proves independent physical servo feedback.</p>
    </section>
  )
}

export default ManualControl
