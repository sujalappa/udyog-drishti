import { monthLabel } from './Charts'

export interface Period { start: string; end: string }

/** Quick ranges (last 3/6/12 months, each year) and a custom from/to, over the months a check covers. */
export default function PeriodBar({ months, value, onChange, busy }: {
  months: string[]
  value: Period
  onChange: (p: Period) => void
  busy: boolean
}) {
  const last = months[months.length - 1]
  const back = (n: number) => ({ start: months[Math.max(0, months.length - n)], end: last })
  const years = [...new Set(months.map((m) => m.slice(0, 4)))].reverse()
  const presets: [string, Period][] = [
    ['Last 3 months', back(3)], ['Last 6 months', back(6)], ['Last 12 months', back(12)],
    ...years.map((y): [string, Period] => {
      const inYear = months.filter((m) => m.startsWith(y))
      return [inYear.length < 12 ? `${y} so far` : y, { start: inYear[0], end: inYear[inYear.length - 1] }]
    }),
  ]
  const same = (p: Period) => p.start === value.start && p.end === value.end
  return (
    <div className="period-bar">
      <span className="label">Period</span>
      {presets.map(([label, p]) => (
        <button key={label} className={same(p) ? 'active' : ''} onClick={() => onChange(p)}>{label}</button>
      ))}
      <select aria-label="From" value={value.start} onChange={(e) => onChange({ start: e.target.value, end: value.end < e.target.value ? e.target.value : value.end })}>
        {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
      </select>
      <span className="muted">to</span>
      <select aria-label="To" value={value.end} onChange={(e) => onChange({ start: value.start > e.target.value ? e.target.value : value.start, end: e.target.value })}>
        {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
      </select>
      {busy && <span className="muted">Updating…</span>}
    </div>
  )
}
