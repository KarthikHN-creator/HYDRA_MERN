import { useEffect, useState } from 'react'
import { api } from '../services/api.js'

const defaultSettings = { preferredControlMode: 'manual', motionConfirmation: true }

function SystemSettings() {
  const [settings, setSettings] = useState(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    api.settings().then((result) => {
      if (active) setSettings({ ...defaultSettings, ...result.data.settings })
    }).catch((error) => {
      if (active) setMessage(error.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const result = await api.updateSettings(settings)
      setSettings({ ...defaultSettings, ...result.data.settings })
      setMessage('Settings saved')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="dashboard-data-card" aria-labelledby="settings-title">
      <div className="dashboard-data-card__heading">
        <div><div className="section-kicker">PREFERENCES</div><h2 id="settings-title">User settings</h2></div>
      </div>
      <form className="settings-form" onSubmit={save}>
        <label>Preferred control mode
          <select value={settings.preferredControlMode} onChange={(event) => setSettings((current) => ({ ...current, preferredControlMode: event.target.value }))} disabled={loading}>
            <option value="manual">Manual</option><option value="voice">Voice</option><option value="gesture">Gesture</option><option value="object-picking">Object picking</option>
          </select>
        </label>
        <label className="settings-checkbox"><input type="checkbox" checked={settings.motionConfirmation} onChange={(event) => setSettings((current) => ({ ...current, motionConfirmation: event.target.checked }))} disabled={loading} /> Ask before sending a motion request</label>
        <button className="action-button action-button--home" type="submit" disabled={loading || saving}>{saving ? 'Saving…' : 'Save settings'}</button>
      </form>
      {message && <p className="dashboard-data-card__message" role="status">{message}</p>}
      <p className="dashboard-data-card__note">Settings are scoped to the default user until authentication is added.</p>
    </section>
  )
}

export default SystemSettings
