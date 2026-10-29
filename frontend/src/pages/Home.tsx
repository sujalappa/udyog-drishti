import { useEffect, useState } from 'react'
import { api } from '../api'
import StatusChip from '../components/StatusChip'
import type { JobListItem } from '../types'

function go(id: string) {
  window.location.hash = `#/jobs/${id}`
}

function jobLine(j: JobListItem): string {
  const s = j.summary ?? {}
  if (j.status !== 'completed') return ''
  return `${s.sites} sites · ${s.counts?.['check first'] ?? 0} to check first · ${s.first_month} to ${s.latest_month}`
}

export default function Home() {
  const [jobs, setJobs] = useState<JobListItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = () => api.jobs().then(setJobs).catch(() => {})
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [])

  const start = async () => {
    setBusy(true)
    setError('')
    try {
      go((await api.createState()).id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the check')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main>
      <section className="hero">
        <h1>Satellite check on Maharashtra's power plants and industrial areas</h1>
        <p className="lead">
          Monthly SO₂ and NO₂ over large coal power plants and polluted industrial areas, measured by the Sentinel-5P
          satellite rather than reported by the plants. Shows where to inspect first and whether a scrubber made a difference.
        </p>
      </section>

      <section className="page">
        <div className="panel area-card start-card">
          <div>
            <h3>Maharashtra</h3>
            <p className="muted small">Coal plants of 500 MW and more, Tarapur and Taloja MIDC, Trombay–Chembur and Chandrapur's cement belt.</p>
          </div>
          <button className="btn btn-primary" disabled={busy} onClick={start}>
            {busy ? 'Starting…' : 'Run the check, 2019 to now'}
          </button>
        </div>
        {error && <div className="error-box">{error}</div>}
      </section>

      <section className="page" id="checks">
        <div className="section-head"><h2>Checks</h2></div>
        {jobs.length === 0 ? (
          <div className="empty muted">No checks yet.</div>
        ) : (
          <div className="panel list-panel">
            <table className="job-list">
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="clickable" onClick={() => go(j.id)}>
                    <td className="job-name">{j.name}</td>
                    <td className="muted">{jobLine(j)}</td>
                    <td><StatusChip status={j.status} /></td>
                    <td className="muted">{new Date(j.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
