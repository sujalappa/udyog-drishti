import { useEffect, useState } from 'react'
import { api, fileUrl } from '../api'
import EventLog from '../components/EventLog'
import ResultsTable from '../components/ResultsTable'
import ScrubberCheck from '../components/ScrubberCheck'
import SiteDetail from '../components/SiteDetail'
import { DownloadsView, SourcesView } from '../components/SourcesView'
import StatusChip from '../components/StatusChip'
import Stepper from '../components/Stepper'
import UnitMap from '../components/UnitMap'
import type { Job, UnitCollection } from '../types'

type Tab = 'table' | 'scrubber' | 'sources' | 'downloads' | 'processing'
const TABS: Record<Tab, string> = {
  table: 'Sites', scrubber: 'Scrubber check', sources: 'Sources and method', downloads: 'Downloads', processing: 'Processing',
}

function Kpis({ job }: { job: Job }) {
  const s = job.summary
  const scrubbed = (s.scrubbed ?? []).map((k) => job.results?.[k]?.name).filter(Boolean)
  const items: [string, string, string][] = [
    [`${s.counts?.['check first'] ?? 0}`, 'sites to check first', 'high SO₂, or SO₂ rising'],
    [`${s.counts?.watch ?? 0}`, 'sites to watch', `of ${s.sites} sites, ${s.capacity_mw?.toLocaleString()} MW of coal`],
    [`${scrubbed.length}`, 'reference plants with scrubbers', scrubbed.join(', ')],
    [`${s.first_month?.slice(0, 4)}–${s.latest_month?.slice(0, 4)}`, 'monthly record', `${s.first_month} to ${s.latest_month}`],
  ]
  return (
    <div className="kpis">
      {items.map(([v, l, n]) => (
        <div key={l} className="kpi"><div className="value">{v}</div><div className="label">{l}</div><div className="note">{n}</div></div>
      ))}
    </div>
  )
}

export default function JobPage({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(null)
  const [units, setUnits] = useState<UnitCollection | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('table')
  const [stage, setStage] = useState<string | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let alive = true
    const load = async () => {
      try {
        const j = await api.job(jobId)
        if (!alive) return
        setJob(j)
        if (j.status === 'queued' || j.status === 'running') timer = setTimeout(load, 2500)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the check')
      }
    }
    load()
    return () => { alive = false; clearTimeout(timer) }
  }, [jobId])

  const done = job?.status === 'completed'
  useEffect(() => {
    if (done && job?.outputs.layers.units && !units) api.unitsOf(job.id, job.outputs.layers.units.file).then(setUnits).catch(() => {})
  }, [done, job, units])

  if (error) return <main className="page"><div className="error-box">{error}</div></main>
  if (!job) return <main className="page"><p className="muted">Loading…</p></main>

  const result = selected ? job.results?.[selected] : null
  return (
    <main className="page job-page">
      <div className="crumbs"><a href="#/">Checks</a> / {job.name}</div>
      <div className="job-head">
        <div>
          <h1>{job.name}</h1>
          <div className="job-meta"><StatusChip status={job.status} />
            <span className="muted">{job.summary.latest_month ? `Sentinel-5P · latest month ${job.summary.latest_month}` : ''}</span>
            {job.event_counts.warning > 0 && <span className="chip chip-warning">{job.event_counts.warning} warning{job.event_counts.warning > 1 ? 's' : ''}</span>}
          </div>
        </div>
        {done && job.outputs.exports.pdf && (
          <a className="btn btn-primary" href={fileUrl(job.id, job.outputs.exports.pdf.file, true)} download>Download report</a>
        )}
      </div>

      {!done && (
        <div className="run-grid">
          <div className="panel"><div className="panel-head"><h2>Steps</h2></div>
            <Stepper stages={job.stages} selected={stage} onSelect={setStage} />
          </div>
          <div>
            <div className="panel"><div className="panel-body">
              {job.stages.filter((x) => x.summary).map((x) => <p key={x.id}><strong>{x.name}:</strong> {x.summary}</p>)}
              {job.status !== 'failed' && <p className="muted">Reading every month of Sentinel-5P since 2019 in Earth Engine; the numbers take about a minute, the two maps a few more.</p>}
            </div></div>
            <EventLog events={job.events} stages={job.stages} />
          </div>
        </div>
      )}

      {done && (
        <>
          <Kpis job={job} />
          <div className="result-grid">
            {units ? <UnitMap job={job} units={units} selected={selected} onSelect={setSelected} /> : <div className="map-wrap map-loading">Loading map…</div>}
            <aside className="panel detail">
              {result ? <SiteDetail r={result} /> : (
                <div className="detail-empty">
                  <h3>Click a plant or industrial area</h3>
                  <p className="muted small">See its SO₂ and NO₂ year by year, its scrubber status, and whether its SO₂ fell against NO₂.</p>
                </div>
              )}
            </aside>
          </div>
          <div className="tabs">
            {(Object.keys(TABS) as Tab[]).map((t) => (
              <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{TABS[t]}</button>
            ))}
          </div>
          {tab === 'table' && <ResultsTable job={job} selected={selected} onSelect={(id) => { setSelected(id); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />}
          {tab === 'scrubber' && <div className="panel"><ScrubberCheck job={job} /></div>}
          {tab === 'sources' && <div className="panel"><SourcesView job={job} /></div>}
          {tab === 'downloads' && <div className="panel"><DownloadsView job={job} /></div>}
          {tab === 'processing' && (
            <div className="run-grid">
              <div className="panel"><div className="panel-head"><h2>Steps</h2></div>
                <Stepper stages={job.stages} selected={stage} onSelect={setStage} /></div>
              <div>
                <div className="panel"><div className="panel-body">
                  {job.stages.map((x) => <p key={x.id}><strong>{x.name}:</strong> {x.summary ?? '–'}</p>)}
                </div></div>
                <EventLog events={job.events} stages={job.stages} />
              </div>
            </div>
          )}
        </>
      )}
    </main>
  )
}
