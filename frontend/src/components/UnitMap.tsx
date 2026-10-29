import * as maplibregl from 'maplibre-gl'
import type { ExpressionSpecification, Map as MLMap, MapLayerMouseEvent } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import { fileUrl } from '../api'
import type { FeatureCollection } from 'geojson'
import type { Job, UnitCollection } from '../types'
import { METRICS, STATUS, gradient, metricExpr, statusExpr, type Metric } from './colors'

const abs = (p: string) => new URL(p, window.location.href).href
maplibregl.setWorkerUrl(abs('/maplibre/maplibre-gl-worker.mjs'))

const MH_BOUNDS: [[number, number], [number, number]] = [[72.6, 15.6], [80.9, 22.1]]
// circle size by capacity; industrial clusters (no MW) get a fixed size
const RADIUS = ['case', ['==', ['get', 'mw'], null], 9,
  ['interpolate', ['linear'], ['sqrt', ['get', 'mw']], 20, 7, 63, 17]] as unknown as ExpressionSpecification

export default function UnitMap({ job, units, selected, onSelect }: {
  job: Job
  units: UnitCollection
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MLMap | null>(null)
  const [ready, setReady] = useState(false)
  const [colorBy, setColorBy] = useState<string>('status')
  const [basemap, setBasemap] = useState<'satellite' | 'streets'>('streets')
  const rasters = Object.entries(job.outputs.rasters)
  const [raster, setRaster] = useState<string>(rasters.find(([k]) => k === 'so2') ? 'so2' : '')
  const metric: Metric | undefined = METRICS.find((m) => m.key === colorBy)

  useEffect(() => {
    if (!box.current) return
    const joined = {
      ...units,
      features: units.features.map((f) => {
        const r = job.results?.[f.properties.id]
        const { series: _s, dry: _d, reasons, ...rest } = r ?? ({} as Record<string, unknown>)
        void _s
        void _d
        return { ...f, properties: { ...f.properties, ...rest, reasons: Array.isArray(reasons) ? reasons.join(', ') : '' } }
      }),
    }
    const m = new maplibregl.Map({
      container: box.current,
      style: {
        version: 8,
        sources: {
          satellite: { type: 'raster', tileSize: 256, maxzoom: 18, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'] },
          streets: { type: 'raster', tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap contributors',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'] },
        },
        layers: [
          { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' }, paint: { 'raster-saturation': -0.35 } },
          { id: 'streets', type: 'raster', source: 'streets', paint: { 'raster-saturation': -0.85, 'raster-opacity': 0.7 } },
        ],
      },
      bounds: MH_BOUNDS,
      fitBoundsOptions: { padding: 16 },
      maxZoom: 14,
      attributionControl: { compact: true },
    })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'site-tip' })
    m.on('load', () => {
      for (const [key, r] of rasters) {
        m.addSource(`r-${key}`, { type: 'image', url: abs(fileUrl(job.id, r.file)), coordinates: r.corners as [[number, number], [number, number], [number, number], [number, number]] })
        m.addLayer({ id: `r-${key}`, type: 'raster', source: `r-${key}`, layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.8 } })
      }
      m.addSource('units', { type: 'geojson', data: joined as unknown as FeatureCollection, promoteId: 'id' })
      m.addLayer({ id: 'units-ring', type: 'circle', source: 'units', filter: ['==', ['get', 'id'], ''],
        paint: { 'circle-radius': ['+', RADIUS, 5] as unknown as ExpressionSpecification, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#111', 'circle-stroke-width': 2.5 } })
      m.addLayer({ id: 'units-dot', type: 'circle', source: 'units',
        paint: { 'circle-radius': RADIUS, 'circle-color': statusExpr(), 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5, 'circle-opacity': 0.95 } })
      m.on('click', 'units-dot', (e: MapLayerMouseEvent) => onSelect(String(e.features?.[0]?.properties?.id ?? '') || null))
      m.on('mousemove', 'units-dot', (e: MapLayerMouseEvent) => {
        m.getCanvas().style.cursor = 'pointer'
        const p = e.features?.[0]?.properties
        if (p) tip.setLngLat(e.lngLat).setText(String(p.name)).addTo(m)
      })
      m.on('mouseleave', 'units-dot', () => { m.getCanvas().style.cursor = ''; tip.remove() })
      setReady(true)
    })
    map.current = m
    return () => { m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, units])

  useEffect(() => {
    const m = map.current
    if (!ready || !m) return
    m.setPaintProperty('units-dot', 'circle-color', colorBy === 'status' ? statusExpr() : metricExpr(metric!))
    m.setLayoutProperty('satellite', 'visibility', basemap === 'satellite' ? 'visible' : 'none')
    m.setLayoutProperty('streets', 'visibility', basemap === 'streets' ? 'visible' : 'none')
    for (const [key] of rasters) m.setLayoutProperty(`r-${key}`, 'visibility', raster === key ? 'visible' : 'none')
    m.setFilter('units-ring', ['==', ['get', 'id'], selected ?? ''])
  }, [ready, colorBy, metric, basemap, raster, selected, rasters])

  useEffect(() => {
    const m = map.current
    if (!ready || !m || !selected) return
    const r = job.results?.[selected]
    if (r && !m.getBounds().contains([r.lon, r.lat])) m.easeTo({ center: [r.lon, r.lat] })
  }, [ready, selected, job.results])

  const activeRaster = raster ? job.outputs.rasters[raster] : null
  return (
    <div className="map-wrap">
      <div ref={box} className="map" />
      <div className="map-controls">
        <h3>Colour sites by</h3>
        <select value={colorBy} onChange={(e) => setColorBy(e.target.value)}>
          <option value="status">Status</option>
          {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        {rasters.length > 0 && <h3>Satellite layer</h3>}
        {rasters.length > 0 && (
          <select value={raster} onChange={(e) => setRaster(e.target.value)}>
            <option value="">None</option>
            {rasters.map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
          </select>
        )}
        <label className="check"><input type="checkbox" checked={basemap === 'satellite'}
          onChange={() => setBasemap(basemap === 'satellite' ? 'streets' : 'satellite')} /> Satellite basemap</label>
      </div>
      <div className="legend">
        {colorBy === 'status' ? (
          <>
            <strong>Site status</strong>
            {Object.values(STATUS).map((c) => (
              <div key={c.label} className="legend-row"><span className="swatch round" style={{ background: c.color }} />{c.label}</div>
            ))}
          </>
        ) : metric ? (
          <>
            <strong>{metric.label}</strong>
            <div className="ramp" style={{ background: gradient(metric.stops) }} />
            <div className="ramp-labels"><span>{metric.stops[0][0]}</span><span>{metric.stops[metric.stops.length - 1][0]}</span></div>
            <div className="legend-source">{metric.unit}</div>
          </>
        ) : null}
        <div className="legend-source">Circle size: plant capacity</div>
        {activeRaster?.legend?.type === 'continuous' && (
          <div className="legend-raster">
            <strong>{activeRaster.label}</strong>
            <div className="ramp" style={{ background: `linear-gradient(90deg,${(activeRaster.legend.palette ?? []).map((c) => `#${c}`).join(',')})` }} />
            <div className="ramp-labels"><span>{activeRaster.legend.min}</span><span>{activeRaster.legend.max}+ {activeRaster.legend.unit}</span></div>
          </div>
        )}
      </div>
    </div>
  )
}
