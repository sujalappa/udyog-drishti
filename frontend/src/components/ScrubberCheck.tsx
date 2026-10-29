import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { Job, ScrubberResult } from '../types'
import { SeriesLine, monthLabel, rolling } from './Charts'
import { GAS } from './colors'

const pct = (v: number | null) => (v == null ? '–' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`)

function verdict(c: ScrubberResult): { text: string; tone: string } {
  if (c.net_change == null) return { text: 'Not enough NO₂ at this site to compare.', tone: 'muted' }
  if (c.net_change <= -0.25) return { text: 'SO₂ fell against NO₂ well beyond plants without scrubbers: consistent with a working scrubber.', tone: 'ok' }
  if (c.net_change >= 0.25) return { text: 'SO₂ rose against NO₂ beyond plants without scrubbers: worth an inspection.', tone: 'bad' }
  if (c.net_change <= -0.1) return { text: 'SO₂ fell against NO₂ more than at plants without scrubbers, but less than a full scrubber would give: possibly partial (some units scrubbed). Confirm with stack readings.', tone: 'partial' }
  return { text: 'No clear change beyond what plants without scrubbers show.', tone: 'muted' }
}

/** Before/after SO2-to-NO2 ratio at one site, against the same change at plants without scrubbers. */
export default function ScrubberCheck({ job }: { job: Job }) {
  const results = job.results ?? {}
  const sites = Object.values(results).filter((r) => r.ratio_mean != null || r.fgd_date)
  const months = Object.values(results)[0]?.series.map((p) => p.month) ?? []
  const first = results.mauda ? 'mauda' : sites[0]?.id ?? ''
  const [site, setSite] = useState(first)
  const [on, setOn] = useState(results[first]?.fgd_date ?? months[months.length - 13] ?? '')
  const [check, setCheck] = useState<ScrubberResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!site || !on) return
    setError('')
    api.scrubber(job.id, site, on).then(setCheck).catch((e) => { setCheck(null); setError(e.message) })
  }, [job.id, site, on])

  const pick = (id: string) => {
    setSite(id)
    if (results[id]?.fgd_date) setOn(results[id].fgd_date!)
  }

  const lines = useMemo(() => {
    const r = results[site]
    if (!r) return null
    const controls = Object.values(results).filter((x) => x.fgd === 'no' && x.id !== site)
    const median = r.series.map((p, i) => {
      const v = controls.map((c) => c.series[i]?.ratio).filter((x): x is number => x != null).sort((a, b) => a - b)
      return { month: p.month, value: v.length ? v[Math.floor(v.length / 2)] : null }
    })
    return { site: rolling(r.series.map((p) => ({ month: p.month, value: p.ratio }))), ref: rolling(median), n: controls.length }
  }, [results, site])

  const v = check ? verdict(check) : null
  return (
    <div className="panel-body cleanup">
      <div className="cleanup-head">
        <div>
          <h3 className="sub">Is the scrubber working?</h3>
          <p className="muted small">A scrubber removes SO₂ but not NO₂, and NO₂ follows how hard the plant runs. So when a scrubber works, SO₂ ÷ NO₂ drops. This compares the 12 months before a date with the months after, and subtracts the change at plants without scrubbers.</p>
        </div>
        <div className="cleanup-pick">
          <label>Site<select value={site} onChange={(e) => pick(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>From<select value={on} onChange={(e) => setOn(e.target.value)}>
            {months.slice(12).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select></label>
        </div>
      </div>
      {lines && <SeriesLine points={lines.site} reference={lines.ref} mark={on} color={GAS.so2} height={150} />}
      <div className="chart-note">
        <span className="swatch-inline" style={{ background: GAS.so2 }} />{results[site]?.name}
        <span className="swatch-inline dashed" />median of {lines?.n ?? 0} plants without scrubbers · SO₂ ÷ NO₂, 6-month rolling mean · Sentinel-5P
      </div>
      {error && <div className="error-box">{error}</div>}
      {check && v && (
        <>
          <div className="kpis cleanup-kpis">
            <div className="kpi"><div className="value">{check.ratio_before ?? '–'} → {check.ratio_after ?? '–'}</div><div className="label">SO₂ ÷ NO₂</div><div className="note">{check.months_before} months before, {check.months_after} after</div></div>
            <div className="kpi"><div className="value">{pct(check.ratio_change)}</div><div className="label">change at this site</div><div className="note">SO₂ {check.so2_before ?? '–'} → {check.so2_after ?? '–'} µmol/m²</div></div>
            <div className="kpi"><div className="value">{pct(check.control_change)}</div><div className="label">change without scrubbers</div><div className="note">median, same months</div></div>
            <div className="kpi"><div className="value">{pct(check.net_change)}</div><div className="label">net change</div><div className="note">site minus plants without scrubbers</div></div>
          </div>
          <div className={`verdict verdict-${v.tone}`}>{v.text}</div>
        </>
      )}
      <p className="muted small">Coal sulphur, the season and satellite processing also move the ratio; that is why plants without scrubbers are the reference. Chandrapur's own stack readings show the satellite ratio drifting down ~10–15% since 2023 with no real change. Months after the monsoon onset carry more noise, so prefer at least a year after the date.</p>
    </div>
  )
}
