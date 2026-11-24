function ServoControl({ servo, angle, disabled, commandDisabled, commandStatus, onChange, onSend }) {
  const inputId = `servo-${servo.number}-angle`
  const hasConfiguredLimits = Number.isFinite(servo.minAngle) && Number.isFinite(servo.maxAngle)
  const hasLimits = hasConfiguredLimits && Math.ceil(servo.minAngle) <= Math.floor(servo.maxAngle)
  const displayAngle = Number.isFinite(angle) ? angle : null
  const minAngle = hasLimits ? Math.ceil(servo.minAngle) : 0
  const maxAngle = hasLimits ? Math.floor(servo.maxAngle) : 0
  const progress = hasLimits && maxAngle > minAngle ? ((displayAngle - minAngle) / (maxAngle - minAngle)) * 100 : 0

  return (
    <article className={`servo-card${disabled ? ' servo-card--disabled' : ''}`}>
      <div className="servo-card__header">
        <div className="servo-card__identity">
          <span className="servo-card__number">0{servo.number}</span>
          <div><h3>Servo {servo.number}</h3><span>{servo.name}</span></div>
        </div>
        <span className="gpio-tag">GPIO {servo.gpio}</span>
      </div>
      <div className="servo-card__reading">
        <label htmlFor={inputId}>Target preview</label>
        <output htmlFor={inputId}>{displayAngle ?? '—'}<span>{displayAngle === null ? '' : 'deg'}</span></output>
      </div>
      <input
        className="servo-slider"
        id={inputId}
        type="range"
        min={minAngle}
        max={maxAngle}
        step="1"
        value={displayAngle ?? minAngle}
        style={{ '--slider-progress': `${progress}%` }}
        disabled={disabled || !servo.calibrated || !hasLimits}
        aria-label={`Servo ${servo.number} preview angle`}
        aria-valuetext={displayAngle === null ? 'Calibration required' : `${displayAngle} degrees, target preview only`}
        onChange={(event) => onChange(servo.number - 1, Math.round(Number(event.target.value)))}
      />
      <div className="servo-card__range"><span>{hasConfiguredLimits ? `${servo.minAngle} deg` : 'No lower limit'}</span><span>{servo.calibrated && hasLimits ? 'Whole-degree targets' : 'Uncalibrated'}</span><span>{hasConfiguredLimits ? `${servo.maxAngle} deg` : 'No upper limit'}</span></div>
      <button type="button" className="servo-send-button" onClick={() => onSend(servo.number)} disabled={commandDisabled || disabled || displayAngle === null || !hasLimits}>
        Send target request
      </button>
      {commandStatus && <span className="servo-command-status" role="status">{commandStatus}</span>}
    </article>
  )
}

export default ServoControl
