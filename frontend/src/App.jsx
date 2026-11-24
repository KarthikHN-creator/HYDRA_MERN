import { useState } from 'react'
import { useSystemStatus } from './hooks/useSystemStatus.js'
import { FeatureCard, Icon, SafetyStatus, StatusBadge } from './components/DashboardComponents.jsx'
import ManualControl from './components/ManualControl.jsx'
import VoiceControl from './components/VoiceControl.jsx'
import GestureControl from './components/GestureControl.jsx'
import ObjectPicking from './components/ObjectPicking.jsx'
import SystemSettings from './components/SystemSettings.jsx'
import CommandHistory from './components/CommandHistory.jsx'
import './App.css'

const features = [
  { icon: 'robot', title: 'Manual Control', description: 'Position each of the six arm joints with individual controls.', detail: '6 servo channels · hardware unavailable' },
  { icon: 'mic', title: 'Voice Control', description: 'Use spoken commands recognized by the laptop voice system.', detail: 'Python + Whisper · not connected' },
  { icon: 'gesture', title: 'Gesture Control', description: 'Explore hands-free interaction through camera-based gestures.', detail: 'Planned feature · unavailable' },
  { icon: 'box', title: 'Object Picking', description: 'Prepare pick and release workflows for future object detection.', detail: 'Planned feature · unavailable' },
]

function App() {
  const [screen, setScreen] = useState('dashboard')
  const systemStatus = useSystemStatus()
  const esp32Label = systemStatus.esp32.connected === true ? 'Connected' : systemStatus.esp32.connected === false ? 'Disconnected' : 'Unknown'
  const esp32Tone = systemStatus.esp32.connected === true ? 'success' : 'muted'
  const obstacleLabel = !systemStatus.telemetry.available || systemStatus.telemetry.obstacleDetected === null
    ? 'Unavailable'
    : systemStatus.telemetry.obstacleDetected ? 'Detected' : 'Clear'
  const reportedAngles = systemStatus.telemetry.servoAngles?.filter((angle) => angle !== null).length || 0

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="HYDRA dashboard">
          <span className="brand__mark"><Icon name="robot" size={22} /></span>
          <span className="brand__name">HYDRA<span className="brand__divider">/</span><span className="brand__sub">ROBOTIC ARM</span></span>
        </a>
        <div className="topbar__right">
          <span className="workspace-label">CONTROL WORKSPACE <span className="workspace-dot" /></span>
          <span className="topbar__separator" />
          <span className="unit-label">ESP32-WROOM-32E</span>
        </div>
      </header>

      <div className="dashboard-content" id="top">
        {screen === 'manual' ? (
          <ManualControl onBack={() => setScreen('dashboard')} systemStatus={systemStatus} />
        ) : screen === 'voice' ? (
          <VoiceControl onBack={() => setScreen('dashboard')} systemStatus={systemStatus} />
        ) : screen === 'gesture' ? (
          <GestureControl onBack={() => setScreen('dashboard')} systemStatus={systemStatus} />
        ) : screen === 'object-picking' ? (
          <ObjectPicking onBack={() => setScreen('dashboard')} />
        ) : (
          <>
        <section className="intro-row">
          <div>
            <div className="eyebrow"><span className="eyebrow__line" /> ARM SYSTEM / OVERVIEW</div>
            <h1>HYDRA <span>robotic arm</span></h1>
            <p className="intro-copy">Six-axis control, safety monitoring, and system status in one workspace.</p>
          </div>
          <div className="connection-summary">
            <StatusBadge tone={esp32Tone}>{esp32Label}</StatusBadge>
            <span className="connection-summary__caption">ESP32 controller</span>
            <StatusBadge tone={systemStatus.backend.apiConnected ? 'success' : 'muted'}>{systemStatus.backend.apiConnected ? 'API Online' : 'API Offline'}</StatusBadge>
          </div>
        </section>

        <section className="network-strip" aria-label="Network connection status">
          <div className="network-strip__icon"><Icon name="wifi" size={19} /></div>
          <div className="network-strip__copy"><span>Backend database</span><small>MongoDB connection used for configuration and history</small></div>
          <StatusBadge tone={systemStatus.backend.database === 'connected' ? 'success' : 'muted'}>{systemStatus.backend.database}</StatusBadge>
          <span className="network-strip__note">No Wi-Fi hardware link is implied</span>
        </section>

        <section className="section-block" aria-labelledby="controls-heading">
          <div className="section-heading">
            <div><div className="section-kicker">INTERFACES</div><h2 id="controls-heading">Control center</h2></div>
            <span className="section-heading__aside">4 MODULES <i /></span>
          </div>
          <div className="feature-grid">
            {features.map((feature) => {
              const isManual = feature.title === 'Manual Control'
              return <FeatureCard
                key={feature.title}
                {...feature}
                status={isManual && systemStatus.esp32.connected ? 'Controller online' : feature.title === 'Object Picking' ? 'Simulation' : 'Unavailable'}
                statusTone={isManual && systemStatus.esp32.connected ? 'success' : feature.title === 'Object Picking' ? 'info' : 'muted'}
                onClick={feature.title === 'Manual Control' ? () => setScreen('manual') : feature.title === 'Voice Control' ? () => setScreen('voice') : feature.title === 'Gesture Control' ? () => setScreen('gesture') : feature.title === 'Object Picking' ? () => setScreen('object-picking') : undefined}
              />
            })}
          </div>
        </section>

        <section className="section-block safety-section" aria-labelledby="safety-heading">
          <div className="section-heading">
            <div><div className="section-kicker">SYSTEM HEALTH</div><h2 id="safety-heading">Safety monitoring</h2></div>
            <span className="telemetry-note"><span className="telemetry-note__dot" /> {systemStatus.telemetry.available ? 'Live telemetry received' : 'Telemetry unavailable'}</span>
          </div>
          <div className="safety-grid">
            <SafetyStatus icon="robot" title="ESP32 controller" value={esp32Label} description="Authenticated controller socket status" tone={esp32Tone} />
            <SafetyStatus icon="alert" title="Obstacle sensor" value={obstacleLabel} description={systemStatus.telemetry.available ? 'Most recent controller telemetry' : 'No sensor reading received'} tone={obstacleLabel === 'Detected' ? 'danger' : obstacleLabel === 'Clear' ? 'success' : 'muted'} />
            <SafetyStatus icon="shield" title="Servo status" value={reportedAngles ? `${reportedAngles} estimates` : 'Unavailable'} description="Controller-reported estimates; not independent feedback" tone={reportedAngles ? 'success' : 'muted'} />
          </div>
        </section>

        <section className="dashboard-data-grid" aria-label="Saved application data">
          <SystemSettings />
          <CommandHistory />
        </section>

        <section className="emergency-panel" aria-labelledby="emergency-heading">
          <div className="emergency-panel__copy">
            <div className="emergency-panel__icon"><Icon name="alert" size={21} /></div>
            <div><h2 id="emergency-heading">Emergency stop</h2><p>Physical emergency-stop hardware is required for real operation.</p></div>
          </div>
          <div className="emergency-panel__action">
            <button type="button" className="emergency-button" disabled aria-describedby="emergency-note">
              <Icon name="alert" size={17} /> Emergency Stop
            </button>
            <span id="emergency-note">UI ONLY · DOES NOT STOP PHYSICAL HARDWARE</span>
          </div>
        </section>

        <footer className="dashboard-footer">
          <span><b>HYDRA</b> DEVELOPMENT DASHBOARD</span>
          <span><i /> HARDWARE FEATURES DISCONNECTED</span>
        </footer>
          </>
        )}
      </div>
    </main>
  )
}

export default App
