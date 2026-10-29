import type { ExpressionSpecification } from 'maplibre-gl'
import type { Fgd, Status } from '../types'

export const STATUS: Record<Status, { label: string; color: string }> = {
  'check first': { label: 'Check first', color: '#b03a2e' },
  watch: { label: 'Watch', color: '#e8a33d' },
  low: { label: 'Low or not detected', color: '#6b8f71' },
  'no data': { label: 'No data', color: '#b8b5ab' },
}

export const FGD: Record<string, { label: string; color: string }> = {
  yes: { label: 'Scrubber in service', color: '#2f7d5b' },
  planned: { label: 'Scrubber planned', color: '#8a6d1f' },
  no: { label: 'Exempt, no scrubber', color: '#9a3b2b' },
  unknown: { label: 'Not checked', color: '#7c7869' },
}
export const fgdOf = (f: Fgd) => FGD[f ?? 'unknown']

export const GAS = { so2: '#c2571a', no2: '#6a4c93', control: '#8a8679' }

export interface Metric {
  key: string
  label: string
  unit: string
  stops: [number, string][]
  source: string
}

export const METRICS: Metric[] = [
  { key: 'so2_12m', label: 'SO₂ above background', unit: 'µmol/m², last 12 months', source: 'Sentinel-5P TROPOMI',
    stops: [[0, '#fdf1e2'], [50, '#fdd0a2'], [100, '#fd8d3c'], [175, '#d94801'], [250, '#7f2704']] },
  { key: 'no2_12m', label: 'NO₂ above background', unit: 'µmol/m², last 12 months', source: 'Sentinel-5P TROPOMI',
    stops: [[0, '#f4f1f8'], [25, '#bfd3e6'], [50, '#8c96c6'], [75, '#88419d'], [100, '#4d004b']] },
  { key: 'ratio_12m', label: 'SO₂ ÷ NO₂', unit: 'low = scrubbed or gas/urban', source: 'Sentinel-5P TROPOMI',
    stops: [[0.5, '#2f7d5b'], [2, '#d9d27a'], [3.5, '#e07b1a'], [5, '#9a2b12']] },
]

export function statusExpr(): ExpressionSpecification {
  const pairs = Object.entries(STATUS).flatMap(([k, v]) => [k, v.color])
  return ['match', ['coalesce', ['get', 'status'], 'no data'], ...pairs, '#b8b5ab'] as unknown as ExpressionSpecification
}

export function metricExpr(m: Metric): ExpressionSpecification {
  return ['case', ['==', ['get', m.key], null], '#d9d6cc',
    ['interpolate', ['linear'], ['get', m.key], ...m.stops.flat()]] as ExpressionSpecification
}

export function gradient(stops: [number, string][]): string {
  return `linear-gradient(90deg,${stops.map(([, c]) => c).join(',')})`
}
