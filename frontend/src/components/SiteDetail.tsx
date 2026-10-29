import type { SiteResult } from '../types'
import { SeriesLine, YearBars, rolling } from './Charts'
import { GAS, STATUS, fgdOf } from './colors'

const num = (v: number | null, d = 0) => (v == null ? '–' : v.toLocaleString(undefined, { maximumFractionDigits: d }))

export default function SiteDetail({ r }: { r: SiteResult }) {
  const st = STATUS[r.status]
  const fgd = fgdOf(r.fgd)
  const maps = `https://www.google.com/maps?q=${r.lat},${r.lon}`
  const pts = (k: 'so2' | 'no2' | 'ratio') => r.series.map((p) => ({ month: p.month, value: p[k] }))
  return (
    <>
      <div className="detail-head">
        <h3>{r.name}</h3>
        <div className="muted small">{r.kind} · {r.district}{r.mw ? ` · ${r.mw.toLocaleString()} MW` : ''} · <a href={maps} target="_blank" rel="noreferrer">{r.lat}, {r.lon}</a></div>
        <div className="cat-badge" style={{ background: st.color, color: r.status === 'watch' || r.status === 'no data' ? '#2b261b' : '#fff' }}>{st.label}</div>
        {r.reasons.length > 0 && <div className="reasons">{r.reasons.join(' · ')}</div>}
        <div className="muted small site-members">{r.members}</div>
      </div>

      <h4>Above local background · last 12 months</h4>
      <div className="ind-row">
        <div><div className="ind-label">SO₂</div><div className="ind-source">Sentinel-5P, within 10 km vs 40–80 km ring</div></div>
        <div className="ind-value">{num(r.so2_12m)}<span className="zval"> µmol/m²</span></div>
      </div>
      <div className="ind-row">
        <div><div className="ind-label">NO₂</div><div className="ind-source">rises and falls with how hard the plant runs</div></div>
        <div className="ind-value">{num(r.no2_12m)}<span className="zval"> µmol/m²</span></div>
      </div>
      <div className="ind-row">
        <div><div className="ind-label">SO₂ ÷ NO₂</div><div className="ind-source">unscrubbed coal ≈ 4–5 here; scrubbers lower it</div></div>
        <div className="ind-value">{num(r.ratio_12m, 1)}</div>
      </div>

      <h4>Year by year</h4>
      <YearBars colors={[GAS.so2, GAS.no2]} labels={['SO₂', 'NO₂']}
        rows={r.dry.map((d) => ({ year: d.year, a: d.so2, b: d.no2 }))} />

      <h4>SO₂ ÷ NO₂, month by month</h4>
      <SeriesLine points={rolling(pts('ratio'))} color={GAS.so2} mark={r.fgd_date ?? undefined} />
      <div className="chart-note">6-month rolling mean{r.fgd_date ? ` · line: scrubber date ${r.fgd_date}` : ''}</div>

      <h4>Scrubber (FGD)</h4>
      <div className="fgd-chip" style={{ borderColor: fgd.color, color: fgd.color }}>{fgd.label}</div>
      <p className="small fgd-note">{r.fgd_note}</p>
      <p className="muted small detail-note">Columns over the site, not stack readings. A change here is a reason to inspect, not proof of a breach.</p>
    </>
  )
}
