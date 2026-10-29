import { useEffect, useMemo, useState } from 'react'
import { api, periodFileUrl } from '../api'
import { monthLabel } from '../components/Charts'
import EventLog from '../components/EventLog'
import PeriodBar, { type Period } from '../components/PeriodBar'
import ResultsTable from '../components/ResultsTable'
import ScrubberCheck from '../components/ScrubberCheck'
import SiteDetail from '../components/SiteDetail'
import { DownloadsView, SourcesView } from '../components/SourcesView'
import StatusChip from '../components/StatusChip'
import Stepper from '../components/Stepper'
import UnitMap from '../components/UnitMap'
import type { Job, PeriodResult, Status, UnitCollection } from '../types'

type Tab = 'table' | 'scrubber' | 'sources' | 'downloads' | 'processing'
const TABS: Record<Tab, string> = {
  table: 'Sites', scrubber: 'Scrubber check', sources: 'Sources and method', downloads: 'Downloads', processing: 'Processing',
}

function Kpis({ job, counts, period }: { job: Job; counts: Record<Status, number>; period: Period }) {
  const s = job.summary
  const scrubbed = (s.scrubbed ?? []).map((k) => job.results?.[k]?.name).filter(Boolean)
  const items: [string, string, string][] = [
    [`${counts['check first'] ?? 0}`, 'sites to check first', 'high SO₂, or SO₂ rising, in this period'],
    [`${counts.watch ?? 0}`, 'sites to watch', `of ${s.sites} sites, ${s.capacity_mw?.toLocaleString()} MW of coal`],
    [`${scrubbed.length}`, 'reference plants with scrubbers', scrubbed.join(', ')],
    [`${monthLabel(period.start)} – ${monthLabel(period.end)}`, 'period shown', `record available ${s.first_month} to ${s.latest_month}`],
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
  const [period, setPeriod] = useState<Period | null>(null)
  const [view, setView] = useState<PeriodResult | null>(null)
  const [periodBusy, setPeriodBusy] = useState(false)
  const [periodError, setPeriodError] = useState('')

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

  const months = useMemo(() => Object.values(job?.results ?? {})[0]?.series.map((p) => p.month) ?? [], [job?.results])
  const first = Object.values(job?.results ?? {})[0]
  const shown: Period | null = period ?? (first?.period ? { start: first.period.start, end: first.period.end } : null)

  useEffect(() => {
    if (!job || !period) return
    let alive = true
    setPeriodBusy(true)
    setPeriodError('')
    api.period(job.id, period.start, period.end)
      .then((v) => { if (alive) setView(v) })
      .catch((e) => { if (alive) setPeriodError(e instanceof Error ? e.message : 'Could not update the period') })
      .finally(() => { if (alive) setPeriodBusy(false) })
    return () => { alive = false }
  }, [job, period])

  if (error) return <main className="page"><div className="error-box">{error}</div></main>
  if (!job) return <main className="page"><p className="muted">Loading…</p></main>

  const results = view?.results ?? job.results ?? {}
  const counts = view?.counts ?? job.summary.counts ?? ({} as Record<Status, number>)
  const result = selected ? results[selected] : null
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
        {done && shown && (
          <a className="btn btn-primary" href={periodFileUrl(job.id, 'pdf', shown.start, shown.end)} download
            title={`PDF for ${monthLabel(shown.start)} – ${monthLabel(shown.end)}`}>Download report</a>
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
          {shown && <PeriodBar months={months} value={shown} onChange={setPeriod} busy={periodBusy} />}
          {periodError && <div className="error-box">{periodError}</div>}
          {shown && <Kpis job={job} counts={counts} period={shown} />}
          <div className="result-grid">
            {units ? <UnitMap job={job} results={results} units={units} selected={selected} onSelect={setSelected} /> : <div className="map-wrap map-loading">Loading map…</div>}
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
          {tab === 'table' && <ResultsTable results={results} selected={selected} onSelect={(id) => { setSelected(id); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />}
          {tab === 'scrubber' && <div className="panel"><ScrubberCheck job={job} /></div>}
          {tab === 'sources' && <div className="panel"><SourcesView job={job} /></div>}
          {tab === 'downloads' && <div className="panel">
            {shown && <div className="panel-body export-grid">
              <a className="export-card" href={periodFileUrl(job.id, 'pdf', shown.start, shown.end)} download>
                <strong>PDF report, {monthLabel(shown.start)} – {monthLabel(shown.end)}</strong>
                <span className="muted small">for the period selected above</span></a>
              <a className="export-card" href={periodFileUrl(job.id, 'csv', shown.start, shown.end)} download>
                <strong>Site table, {monthLabel(shown.start)} – {monthLabel(shown.end)} (CSV)</strong>
                <span className="muted small">for the period selected above</span></a>
            </div>}
            <DownloadsView job={job} only={['geojson', 'kml']} note="last 12 months, as when the check ran" />
          </div>}
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
