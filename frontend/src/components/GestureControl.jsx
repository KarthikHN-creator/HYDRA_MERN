import { useState } from 'react'
import { Icon, StatusBadge } from './DashboardComponents.jsx'

const gestures = [
  { name: 'Open Palm', action: 'Stop', icon: 'gesture' },
  { name: 'Thumbs Up', action: 'Start', icon: 'hand' },
  { name: 'Point Left', action: 'Move Left', symbol: 'LEFT' },
  { name: 'Point Right', action: 'Move Right', symbol: 'RIGHT' },
  { name: 'Point Up', action: 'Move Up', symbol: 'UP' },
  { name: 'Point Down', action: 'Move Down', symbol: 'DOWN' },
]

function GestureControl({ onBack }) {
  const [active, setActive] = useState(false)

  return (
    <section className="gesture-screen" aria-labelledby="gesture-title">
      <button className="back-link" type="button" onClick={onBack}><Icon name="back" size={17} /> Back to dashboard</button>

      <div className="manual-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow__line" /> ARM SYSTEM / GESTURE CONTROL</div>
          <h1 id="gesture-title">Gesture <span>control</span></h1>
          <p className="intro-copy">Camera-based interaction preview for the HYDRA robotic arm.</p>
        </div>
        <div className="manual-connection">
          <StatusBadge tone="muted">ESP32 Disconnected</StatusBadge>
          <span>Gesture recognition unavailable</span>
        </div>
      </div>

      <div className="gesture-demo-notice" role="note">
        <Icon name="alert" size={17} />
        <p><strong>UI demonstration only.</strong> The camera preview is a placeholder. No camera access, image processing, gesture recognition, or hardware communication is active.</p>
      </div>

      <div className="gesture-layout">
        <section className={`camera-panel${active ? ' camera-panel--active' : ''}`} aria-label="Gesture camera preview">
          <div className="camera-panel__heading"><div><div className="section-kicker">INPUT SOURCE</div><h2>Camera preview</h2></div><StatusBadge tone={active ? 'info' : 'muted'}>{active ? 'Gesture Control Active' : 'Camera Off'}</StatusBadge></div>
          <div className={`camera-preview${active ? ' camera-preview--active' : ''}`}>
            <span className="camera-preview__corner camera-preview__corner--tl" />
            <span className="camera-preview__corner camera-preview__corner--tr" />
            <span className="camera-preview__corner camera-preview__corner--bl" />
            <span className="camera-preview__corner camera-preview__corner--br" />
            <div className="camera-preview__content">
              <span className="camera-preview__icon"><Icon name="camera" size={31} /></span>
              <strong>{active ? 'Gesture Control Active' : 'Camera Off'}</strong>
              <span>CAMERA PREVIEW PLACEHOLDER</span>
            </div>
            <span className="camera-preview__indicator"><i /> {active ? 'UI ACTIVE' : 'NO VIDEO INPUT'}</span>
          </div>
          <div className="camera-panel__footer">
            <span><i className={active ? 'camera-state-dot camera-state-dot--active' : 'camera-state-dot'} />{active ? 'Active UI state only' : 'Camera permission not requested'}</span>
            {!active ? (
              <button className="gesture-start-button" type="button" onClick={() => setActive(true)}><Icon name="gesture" size={17} /> Start Gesture Control</button>
            ) : (
              <button className="gesture-stop-button" type="button" onClick={() => setActive(false)}><span className="gesture-stop-button__square" /> Stop Gesture Control</button>
            )}
          </div>
        </section>

        <section className="gesture-list-panel" aria-labelledby="supported-gestures-title">
          <div className="gesture-list-panel__heading"><div><div className="section-kicker">REFERENCE</div><h2 id="supported-gestures-title">Example supported gestures</h2></div><span>6 EXAMPLES</span></div>
          <div className="gesture-list">
            {gestures.map((gesture) => (
              <div className="gesture-example" key={gesture.name}>
                <span className="gesture-example__symbol">{gesture.icon ? <Icon name={gesture.icon} size={18} /> : gesture.symbol}</span>
                <span className="gesture-example__name">{gesture.name}</span>
                <span className="gesture-example__arrow" aria-hidden="true">-&gt;</span>
                <span className="gesture-example__action">{gesture.action}</span>
              </div>
            ))}
          </div>
          <p className="gesture-list-panel__note">Examples only. These gestures are not currently detected or sent as commands.</p>
        </section>
      </div>
    </section>
  )
}

export default GestureControl
