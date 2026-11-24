import { useEffect, useState } from 'react'
import { api } from '../services/api.js'

function CommandHistory() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Loading recent command records…')

  useEffect(() => {
    let active = true
    api.commands({ page: 1, limit: 5 }).then((result) => {
      if (!active) return
      setRecords(result.data)
      setMessage(result.data.length ? '' : 'No command records yet')
    }).catch((error) => {
      if (active) setMessage(error.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  return (
    <section className="dashboard-data-card" aria-labelledby="history-title">
      <div className="dashboard-data-card__heading"><div><div className="section-kicker">RECENT ACTIVITY</div><h2 id="history-title">Command history</h2></div><span>{records.length} RECORDS</span></div>
      {message ? <p className="dashboard-data-card__message" role="status">{loading ? message : `History unavailable: ${message}`}</p> : (
        <ul className="command-history-list">
          {records.map((record) => <li key={record._id}>
            <div><strong>{record.action}</strong><span>{record.source} · {record.status}</span></div>
            <time dateTime={record.createdAt}>{new Date(record.createdAt).toLocaleString()}</time>
          </li>)}
        </ul>
      )}
    </section>
  )
}

export default CommandHistory
