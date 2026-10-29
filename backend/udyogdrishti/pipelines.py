"""Statewide stack check: SO2 and NO2 above background at every big plant and cluster, as a job with maps and exports."""

from __future__ import annotations

import json
import traceback
from concurrent.futures import ThreadPoolExecutor
import urllib.request

from . import air, report
from .earthengine import EEError, init_ee
from .exports import write_csv, write_geojson, write_kml
from .jobs import Job
from .layers import corners

STAGES = [
    {"id": "sites", "name": "Plants and clusters", "description": "Big coal plants and polluted industrial clusters"},
    {"id": "columns", "name": "Monthly SO₂ and NO₂", "description": "Sentinel-5P above local background, every month"},
    {"id": "flags", "name": "Where to check", "description": "Level, trend and scrubber ratio per site"},
    {"id": "maps", "name": "Maps", "description": "SO₂ and NO₂ over Maharashtra, last 12 months"},
    {"id": "outputs", "name": "Report and exports", "description": "PDF, CSV, GeoJSON and KML"},
]
COLUMNS = [
    ("name", "Site"), ("status", "Status"), ("reasons", "Why"), ("kind", "Type"), ("district", "District"),
    ("mw", "Capacity (MW)"), ("so2_mean", "SO₂ above background, period mean (µmol/m²)"),
    ("no2_mean", "NO₂ above background, period mean (µmol/m²)"), ("ratio_mean", "SO₂ ÷ NO₂"),
    ("so2_change", "SO₂ change, latest Jan–May in period vs 2021-2024"), ("fgd", "Scrubber (FGD)"), ("fgd_note", "Scrubber notes"),
    ("members", "Plants in the site"), ("lat", "Latitude"), ("lon", "Longitude"),
]
STATUS_KML = {"check first": "ff0000c0", "watch": "ff00a5ff", "low": "ff50a050", "no data": "ff999999"}
MAP_BBOX = air.BBOX


def flat_rows(results: dict[str, dict]) -> list[dict]:
    """Table rows, most urgent first, without the monthly series."""
    order = {"check first": 0, "watch": 1, "low": 2, "no data": 3}
    rows = sorted(results.values(), key=lambda r: (order[r["status"]], -(r["so2_mean"] or 0)))
    return [{k: v for k, v in r.items() if k not in ("series", "dry", "period")} | {"reasons": ", ".join(r["reasons"])}
            for r in rows]


def counts_of(results: dict[str, dict]) -> dict[str, int]:
    return {s: sum(r["status"] == s for r in results.values()) for s in ("check first", "watch", "low", "no data")}


def run_state_job(job: Job) -> None:
    try:
        opts = job.state["options"]
        months = air.months_since(int(opts.get("start_year", air.START_YEAR)))
        for s in air.SOURCES:
            job.add_provenance(s)

        job.start_stage("sites")
        fc = {"type": "FeatureCollection", "features": [
            {"type": "Feature", "properties": {"id": sid, "name": s["name"]},
             "geometry": {"type": "Point", "coordinates": [s["lon"], s["lat"]]}} for sid, s in air.SITES.items()]}
        job.path("sites.geojson").write_text(json.dumps(fc), encoding="utf-8")
        job.set_layer("units", "sites.geojson", "Plants and clusters")
        plants = sum(s["kind"] == "Coal power" for s in air.SITES.values())
        mw = sum(s["mw"] or 0 for s in air.SITES.values() if s["kind"] == "Coal power")
        job.finish_stage("sites", f"{plants} coal power sites ({mw:,} MW) and {len(air.SITES) - plants} industrial "
                                  "areas", {"sites": len(air.SITES)})

        job.start_stage("columns")
        data = air.monthly_enhancements(months)
        job.finish_stage("columns", f"{len(months)} months, {months[0][0]}-{months[0][1]:02d} to "
                                    f"{months[-1][0]}-{months[-1][1]:02d}")

        job.start_stage("flags")
        results = {sid: air.summarise(sid, data[sid], months) for sid in air.SITES}
        counts = counts_of(results)
        job.path("results.json").write_text(json.dumps(results), encoding="utf-8")
        latest = f"{months[-1][0]}-{months[-1][1]:02d}"
        job.update("summary", {
            "kind": "state", "sites": len(results), "plants": plants, "capacity_mw": mw, "counts": counts,
            "first_month": f"{months[0][0]}-{months[0][1]:02d}", "latest_month": latest,
            "scrubbed": [k for k, r in results.items() if r["fgd"] == "yes"], "method": air.METHOD,
        })
        job.finish_stage("flags", f"{counts['check first']} to check first, {counts['watch']} to watch", counts)

        job.start_stage("maps")
        try:
            ee = init_ee()
            region = ee.Geometry.Rectangle(MAP_BBOX, None, False)
            last12 = months[-12:]

            def render(gas):
                # a year of daily orbits is heavy; ~1 km pixels match TROPOMI and render in ~2-3 minutes
                img, vis = air.map_image(gas, last12)
                url = img.getThumbURL({"region": region, "dimensions": 800, "format": "png", "crs": "EPSG:4326"})
                job.path(f"{gas}.png").write_bytes(urllib.request.urlopen(url, timeout=900).read())
                return vis

            with ThreadPoolExecutor(max_workers=2) as pool:
                rendered = dict(zip(("so2", "no2"), pool.map(render, ("so2", "no2"))))
            for gas, label in (("so2", "SO₂"), ("no2", "NO₂")):
                lo, hi, pal = rendered[gas]
                job.set_raster(gas, f"{gas}.png", corners(MAP_BBOX),
                               f"{label} column, {last12[0][0]}-{last12[0][1]:02d} to {latest} (Sentinel-5P)",
                               {"type": "continuous", "min": lo, "max": hi, "unit": "µmol/m²",
                                "palette": pal})
            job.finish_stage("maps", "SO₂ and NO₂ maps ready")
        except Exception as exc:
            job.event("warning", "MAPS_FAILED", f"Map layers could not be rendered: {exc}",
                      action="Results and exports are unaffected")
            job.skip_stage("maps", "Map layers unavailable")

        job.start_stage("outputs")
        flat = flat_rows(results)
        write_csv(job.path("sites.csv"), flat, COLUMNS)
        flat_by_id = {r["id"]: r for r in flat}
        write_geojson(job.path("sites_results.geojson"), fc, flat_by_id)
        write_kml(job.path("sites.kml"), fc, flat_by_id, "name", COLUMNS[1:13],
                  lambda r: STATUS_KML.get(r["status"], "ff999999"))
        report.build(
            job.path("stack_report.pdf"), "Industrial SO₂ and NO₂ watch: Maharashtra",
            f"Udyog-drishti AI · Sentinel-5P · {months[0][0]}-{months[0][1]:02d} to {latest}",
            [("Sites", f"{plants} coal power sites ({mw:,} MW) and {len(results) - plants} industrial areas"),
             ("Check first / watch", f"{counts['check first']} / {counts['watch']}"),
             ("Reference plants with scrubbers", ", ".join(results[k]["name"] for k in job.state["summary"]["scrubbed"])),
             ("Months analysed", f"{len(months)}")],
            air.METHOD, job.state["provenance"], COLUMNS[:11], flat,
            "Satellite columns show where and when a plant's plume changed. They do not measure stack concentration; "
            "use them to choose which plants to inspect and to check whether scrubbers changed what reaches the air.")
        for fmt, f, label in (("pdf", "stack_report.pdf", "PDF report"), ("csv", "sites.csv", "Site table (CSV)"),
                              ("geojson", "sites_results.geojson", "Map data (GeoJSON)"),
                              ("kml", "sites.kml", "Google Earth (KML)")):
            job.set_export(fmt, f, label)
        job.finish_stage("outputs", "PDF, CSV, GeoJSON and KML ready")
        job.set_status("completed")
    except Exception as exc:
        stage = job.state.get("current_stage")
        msg = str(exc) if isinstance(exc, (EEError, ValueError, KeyError)) else f"{type(exc).__name__}: {exc}"
        job.event("error", "JOB_FAILED", msg, action="Try again; if it repeats, check the Earth Engine login",
                  data={"trace": traceback.format_exc()[-2000:]})
        if stage:
            job.fail_stage(stage, msg)
        job.set_status("failed")
