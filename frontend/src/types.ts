import type { Geometry } from 'geojson'

export type StageStatus = 'pending' | 'running' | 'done' | 'skipped' | 'failed'
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed'
export type EventLevel = 'info' | 'warning' | 'error'
export type Status = 'check first' | 'watch' | 'low' | 'no data'

export interface Stage {
  id: string
  name: string
  description: string
  status: StageStatus
  started_at: string | null
  finished_at: string | null
  summary: string | null
  metrics: Record<string, unknown>
  preview: string | null
}

export interface JobEvent {
  time: string
  level: EventLevel
  code: string
  stage: string | null
  message: string
  action: string | null
}

export interface Legend {
  type: 'continuous' | 'categorical'
  min?: number
  max?: number
  unit?: string
  palette?: string[]
  items?: { label: string; color: string }[]
}

export interface RasterOutput {
  file: string
  corners: [number, number][]
  label: string
  legend: Legend | null
}

export interface FileOutput {
  file: string
  label: string
}

export interface Source {
  key?: string
  dataset: string
  provider?: string
  source: string
  resolution_m?: number
  license: string
  used_for?: string
  citation?: string
}

export interface MonthPoint {
  month: string
  so2: number | null
  no2: number | null
  ratio: number | null
}

export interface DryPoint {
  year: number
  so2: number | null
  no2: number | null
  ratio: number | null
}

export type Fgd = 'yes' | 'no' | 'planned' | null

export interface SiteResult {
  id: string
  name: string
  kind: string
  district: string
  mw: number | null
  members: string
  fgd: Fgd
  fgd_date: string | null
  fgd_note: string
  lat: number
  lon: number
  so2_12m: number | null
  no2_12m: number | null
  ratio_12m: number | null
  dry: DryPoint[]
  dry_year: number | null
  so2_change: number | null
  series: MonthPoint[]
  reasons: string[]
  status: Status
}

export interface ScrubberResult {
  months_before: number
  months_after: number
  so2_before: number | null
  so2_after: number | null
  no2_before: number | null
  no2_after: number | null
  ratio_before: number | null
  ratio_after: number | null
  ratio_change: number | null
  control_change: number | null
  net_change: number | null
  controls: Record<string, number | null>
}

export interface Summary {
  kind?: 'state'
  sites?: number
  plants?: number
  capacity_mw?: number
  counts?: Record<Status, number>
  first_month?: string
  latest_month?: string
  scrubbed?: string[]
  method?: Record<string, string>
}

export interface Job {
  id: string
  name: string
  mode: 'state'
  status: JobStatus
  created_at: string
  finished_at: string | null
  options: Record<string, string | number>
  stages: Stage[]
  outputs: {
    layers: Record<string, FileOutput>
    rasters: Record<string, RasterOutput>
    exports: Record<string, FileOutput>
  }
  summary: Summary
  provenance: Source[]
  event_counts: Record<EventLevel, number>
  events: JobEvent[]
  results: Record<string, SiteResult> | null
}

export interface JobListItem {
  id: string
  name: string
  mode: 'state'
  status: JobStatus
  created_at: string
  finished_at: string | null
  summary: Summary
}

export interface UnitFeature {
  type: 'Feature'
  properties: { id: string; name: string }
  geometry: Geometry
}

export interface UnitCollection {
  type: 'FeatureCollection'
  features: UnitFeature[]
}
