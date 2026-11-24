import { useState } from 'react'
import { Icon } from './DashboardComponents.jsx'

const objects = [
  { name: 'Red Cube', color: 'red', shape: 'cube' },
  { name: 'Blue Cylinder', color: 'blue', shape: 'cylinder' },
  { name: 'Green Ball', color: 'green', shape: 'ball' },
]

function ObjectPicking({ onBack }) {
  const [selectedObject, setSelectedObject] = useState(null)
  const [status, setStatus] = useState('Ready')

  function reset() {
    setSelectedObject(null)
    setStatus('Ready')
  }

  return (
    <section className="object-picking-screen">
      <button type="button" className="back-link" onClick={onBack}><Icon name="back" size={16} /> Back to Dashboard</button>

      <div className="manual-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow__line" /> PICKING WORKSPACE / SIMULATION</div>
          <h1>Object <span>picking</span></h1>
          <p className="intro-copy">Select a sample object to preview a simulated picking workflow.</p>
        </div>
        <span className="status-badge status-badge--info"><i /> UI simulation</span>
      </div>

      <div className="picking-layout">
        <section className="picking-workspace" aria-labelledby="workspace-heading">
          <div className="picking-panel-heading">
            <div><div className="section-kicker">VISUAL WORKSPACE</div><h2 id="workspace-heading">Object area</h2></div>
            <span className="picking-panel-tag"><i /> PREVIEW ONLY</span>
          </div>
          <div className="object-stage" aria-label="Placeholder area for objects">
            <span className="object-stage__corner object-stage__corner--tl" />
            <span className="object-stage__corner object-stage__corner--tr" />
            <span className="object-stage__corner object-stage__corner--bl" />
            <span className="object-stage__corner object-stage__corner--br" />
            <div className="object-stage__grid" />
            {selectedObject ? (
              <div className="object-stage__preview">
                <span className={`sample-object sample-object--${selectedObject.color} sample-object--${selectedObject.shape}`} />
                <strong>{selectedObject.name}</strong>
              </div>
            ) : (
              <div className="object-stage__empty">
                <span className="object-stage__icon"><Icon name="box" size={25} /></span>
                <strong>Object preview area</strong>
                <span>Choose an object to display it here</span>
              </div>
            )}
            <span className="object-stage__caption">WORKSPACE PLACEHOLDER</span>
          </div>
          <div className="selected-object-card" aria-live="polite">
            <span className="selected-object-card__marker"><Icon name="box" size={16} /></span>
            <div><span>SELECTED OBJECT</span><strong>{selectedObject?.name || 'None selected'}</strong></div>
          </div>
        </section>

        <aside className="picking-controls">
          <section className="picking-card" aria-labelledby="available-objects-heading">
            <div className="picking-panel-heading">
              <div><div className="section-kicker">SAMPLE LIBRARY</div><h2 id="available-objects-heading">Available Objects</h2></div>
              <span className="object-count">03</span>
            </div>
            <div className="object-options">
              {objects.map((object) => {
                const isSelected = selectedObject?.name === object.name
                return (
                  <button
                    type="button"
                    key={object.name}
                    className={`object-option${isSelected ? ' object-option--selected' : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => { setSelectedObject(object); setStatus('Ready') }}
                  >
                    <span className={`object-option__swatch sample-object sample-object--${object.color} sample-object--${object.shape}`} />
                    <span className="object-option__name">{object.name}</span>
                    <span className="object-option__check">{isSelected ? '✓' : '+'}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="picking-status-card" aria-labelledby="picking-status-heading" aria-live="polite">
            <div className="picking-status-card__top">
              <div className="picking-status-card__icon"><span /></div>
              <div><div className="section-kicker">WORKFLOW STATUS</div><h2 id="picking-status-heading">{status}</h2></div>
            </div>
            <p>{status === 'Ready' ? 'Select an object, then start the picking simulation.' : 'This is a visual simulation. No hardware action was performed.'}</p>
          </section>

          <div className="picking-actions">
            <button type="button" className="picking-start-button" disabled={!selectedObject} onClick={() => setStatus('Picking Simulation Started')}>
              <Icon name="hand" size={16} /> Start Picking
            </button>
            <button type="button" className="picking-reset-button" onClick={reset}>Reset</button>
          </div>
          <p className="picking-disclaimer">UI ONLY · NO SENSORS, CAMERA, BACKEND, OR SERVOS CONNECTED</p>
        </aside>
      </div>
    </section>
  )
}

export default ObjectPicking
