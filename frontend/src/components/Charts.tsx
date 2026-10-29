const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const monthLabel = (m: string) => `${MON[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`

type Pt = { month: string; value: number | null }

/** Rolling mean over `n` months, ignoring gaps; null when fewer than half the window is known. */
export function rolling(points: Pt[], n = 6): Pt[] {
  return points.map((p, i) => {
    const w = points.slice(Math.max(0, i - n + 1), i + 1).map((x) => x.value).filter((v): v is number => v != null)
    return { month: p.month, value: w.length >= Math.ceil(n / 2) ? w.reduce((a, b) => a + b, 0) / w.length : null }
  })
}

/** Monthly line chart; optional dashed reference line (for example plants without scrubbers) and a marked month. */
export function SeriesLine({ points, color, reference, mark, height = 80, unit = '' }: {
  points: Pt[]
  color: string
  reference?: Pt[]
  mark?: string
  height?: number
  unit?: string
}) {
  const known = [...points, ...(reference ?? [])].map((p) => p.value).filter((v): v is number => v != null)
  if (known.length < 2) return <div className="muted small">Not enough clear months.</div>
  const lo = Math.min(0, ...known), hi = Math.max(...known) * 1.08 || 1
  const W = 300, H = height
  const x = (i: number) => (i / (points.length - 1)) * W
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H
  const path = (ps: Pt[]) => {
    let d = ''
    ps.forEach((p, i) => {
      if (p.value == null) return
      d += `${d && ps[i - 1]?.value != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)} `
    })
    return d
  }
  const mi = mark ? points.findIndex((p) => p.month >= mark) : -1
  return (
    <div className="sline">
      <div className="sline-y"><span>{hi.toFixed(hi < 10 ? 1 : 0)}{unit}</span><span>{lo.toFixed(0)}</span></div>
      <svg className="iline" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}>
        {lo < 0 && <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="iline-normal" />}
        {mi >= 0 && <line x1={x(mi)} x2={x(mi)} y1={0} y2={H} className="iline-mark" />}
        {reference && <path d={path(reference)} fill="none" stroke="#8a8679" strokeWidth={1.6} strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke" />}
        <path d={path(points)} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mbars-axis">
        <span>{monthLabel(points[0].month)}</span>
        <span>{monthLabel(points[Math.floor(points.length / 2)].month)}</span>
        <span>{monthLabel(points[points.length - 1].month)}</span>
      </div>
    </div>
  )
}

/** Grouped bars per year for two values (SO2 and NO2 in the January–May dry season). */
export function YearBars({ rows, colors, labels, highlight }: {
  rows: { year: number; a: number | null; b: number | null }[]
  colors: [string, string]
  labels: [string, string]
  highlight?: number
}) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.a ?? 0, r.b ?? 0]))
  const h = (v: number | null) => `${v == null ? 0 : Math.max(0, (v / max) * 100)}%`
  return (
    <div className="ybars">
      <div className="ybars-plot">
        {rows.map((r) => (
          <div key={r.year} className={`ybar-group ${r.year === highlight ? 'hl' : ''}`} title={`${r.year}: ${labels[0]} ${r.a ?? '–'}, ${labels[1]} ${r.b ?? '–'}`}>
            <div className="ybar" style={{ height: h(r.a), background: colors[0] }} />
            <div className="ybar" style={{ height: h(r.b), background: colors[1] }} />
          </div>
        ))}
      </div>
      <div className="ybars-axis">{rows.map((r) => <span key={r.year}>{String(r.year).slice(2)}</span>)}</div>
      <div className="chart-note">
        <span className="swatch-inline" style={{ background: colors[0] }} />{labels[0]}
        <span className="swatch-inline" style={{ background: colors[1] }} />{labels[1]} · January–May each year · µmol/m² above background{highlight ? ` · shaded: ${highlight}, used for the trend` : ''}
      </div>
    </div>
  )
}
