import { useMemo, useState } from 'react'
import type { SiteResult } from '../types'
import { STATUS, fgdOf } from './colors'

type Col = { key: keyof SiteResult; label: string; source?: string; num?: boolean }

const COLS: Col[] = [
  { key: 'name', label: 'Site' },
  { key: 'status', label: 'Status', source: 'rules in Sources' },
  { key: 'reasons', label: 'Why' },
  { key: 'district', label: 'District' },
  { key: 'mw', label: 'MW', source: 'GPPD', num: true },
  { key: 'so2_mean', label: 'SO₂', source: 'above background, period', num: true },
  { key: 'no2_mean', label: 'NO₂', source: 'above background, period', num: true },
  { key: 'ratio_mean', label: 'SO₂ ÷ NO₂', source: 'Sentinel-5P', num: true },
  { key: 'so2_change', label: 'SO₂ trend', source: 'latest Jan–May vs 2021-24', num: true },
  { key: 'fgd', label: 'Scrubber', source: 'notification, company reports' },
]
const ORDER = ['check first', 'watch', 'low', 'no data']

export default function ResultsTable({ results, selected, onSelect }: {
  results: Record<string, SiteResult>
  selected: string | null
  onSelect: (id: string) => void
}) {
  const [sort, setSort] = useState<{ key: keyof SiteResult; asc: boolean }>({ key: 'status', asc: true })
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const all = Object.entries(results).map(([id, r]) => ({ id, r }))
    const filtered = q ? all.filter(({ r }) => r.name.toLowerCase().includes(q.toLowerCase())) : all
    const val = (r: SiteResult) => sort.key === 'status' ? ORDER.indexOf(r.status) : r[sort.key]
    return filtered.sort((a, b) => {
      const x = val(a.r), y = val(b.r)
      if (x == null) return 1
      if (y == null) return -1
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
      return (sort.asc ? c : -c) || (b.r.so2_mean ?? 0) - (a.r.so2_mean ?? 0)
    })
  }, [results, sort, q])

  const cell = (c: Col, r: SiteResult) => {
    const v = r[c.key]
    if (c.key === 'status') {
      const s = STATUS[r.status]
      return <span className="cls" style={{ background: s.color, color: r.status === 'watch' || r.status === 'no data' ? '#2b261b' : '#fff' }}>{s.label}</span>
    }
    if (c.key === 'reasons') return r.reasons.join(', ')
    if (c.key === 'fgd') return <span style={{ color: fgdOf(r.fgd).color, fontWeight: 600 }}>{fgdOf(r.fgd).label}</span>
    if (c.key === 'so2_change') return r.so2_change == null ? '–' : `${r.so2_change > 0 ? '+' : ''}${(r.so2_change * 100).toFixed(0)}%`
    if (typeof v === 'number') return v.toLocaleString(undefined, { maximumFractionDigits: 1 })
    return v == null ? '–' : String(v)
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{rows.length} sites</h2>
        <input className="search-input" type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.key} className={c.num ? 'num' : ''} title={c.source ? `Source: ${c.source}` : undefined}
                  onClick={() => setSort({ key: c.key, asc: sort.key === c.key ? !sort.asc : !c.num })}>
                  {c.label}{sort.key === c.key ? (sort.asc ? ' ↑' : ' ↓') : ''}
                  {c.source && <div className="th-source">{c.source}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, r }) => (
              <tr key={id} className={`clickable ${selected === id ? 'sel' : ''}`} onClick={() => onSelect(id)}>
                {COLS.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>{cell(c, r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
