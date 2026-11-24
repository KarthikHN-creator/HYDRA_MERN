const iconPaths = {
  robot: <><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M9 7V4h6v3M8 12h.01M16 12h.01M9 16h6M12 1v3"/></>,
  wifi: <><path d="M5 9a11 11 0 0 1 14 0M8 12a6.5 6.5 0 0 1 8 0M11 15a2 2 0 0 1 2 0M12 19h.01"/></>,
  hand: <><path d="M8 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v7-3a1.5 1.5 0 0 1 3 0v5c0 4-2 7-6 7h-2c-2 0-3.5-1-5-3l-3-4a1.5 1.5 0 0 1 2-2l2 2"/></>,
  mic: <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M9 22h6"/></>,
  gesture: <><path d="M8 12V5a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v7-4a1.5 1.5 0 0 1 3 0v7c0 4-2 7-6 7h-2c-2 0-3.5-1-5-3l-3-4a1.5 1.5 0 0 1 2-2l2 2"/></>,
  box: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 8 9 5 9-5M3 8v9l9 5 9-5V8M12 13v9"/></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
  alert: <><path d="M10.3 3.9 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/></>,
  arrow: <><path d="M7 17 17 7M7 7h10v10"/></>,
  back: <><path d="m15 18-6-6 6-6"/><path d="M9 12h11"/></>,
  home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
  camera: <><path d="M14 5 15.5 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4l1.5-2H14Z"/><circle cx="12" cy="13" r="3.5"/></>,
}

export function Icon({ name, size = 20 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {iconPaths[name] || iconPaths.robot}
    </svg>
  )
}

export function StatusBadge({ children, tone = 'muted' }) {
  return <span className={`status-badge status-badge--${tone}`}><i />{children}</span>
}

export function FeatureCard({ icon, title, description, detail, onClick, status = 'Unavailable', statusTone = 'muted' }) {
  const Wrapper = onClick ? 'button' : 'article'

  return (
    <Wrapper className={`feature-card${onClick ? ' feature-card--interactive' : ''}`} onClick={onClick} type={onClick ? 'button' : undefined}>
      <div className={`feature-icon feature-icon--${icon}`}><Icon name={icon} size={21} /></div>
      <div className="feature-card__body">
        <div className="feature-card__heading"><h3>{title}</h3><StatusBadge tone={statusTone}>{status}</StatusBadge></div>
        <p>{description}</p>
        <div className="feature-card__detail">{detail}</div>
      </div>
      <span className="feature-card__arrow"><Icon name="arrow" size={16} /></span>
    </Wrapper>
  )
}

export function SafetyStatus({ icon, title, value, description, tone = 'muted' }) {
  return (
    <div className="safety-status">
      <div className={`safety-status__icon safety-status__icon--${tone}`}><Icon name={icon} size={18} /></div>
      <div className="safety-status__copy"><span>{title}</span><strong>{value}</strong><small>{description}</small></div>
      <span className={`safety-status__indicator safety-status__indicator--${tone}`} />
    </div>
  )
}
