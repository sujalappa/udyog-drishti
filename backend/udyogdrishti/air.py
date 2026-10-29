"""SO2 and NO2 above local background at Maharashtra's big coal plants and industrial clusters (Sentinel-5P).

Per site and month (TROPOMI offline L3, cloud fraction < 0.3):
  enhancement = mean column within NEAR_KM of the site  -  median column in a RING_KM ring around it
The ring removes the regional background and its seasonal swing; what is left is the site's own plume.

A scrubber (FGD) removes SO2 but not NO2, and NO2 rises and falls with how hard the plant runs. So the ratio of
SO2 to NO2 enhancement falls when a scrubber works, even if the plant runs harder. The scrubber check compares this
ratio before and after a date with the same change at plants without scrubbers (a difference-in-differences).

Satellite columns are not stack concentrations: they cannot show compliance with the mg/Nm3 norm, miss releases
outside the ~13:30 overpass, and cannot separate plants a few km apart (those are grouped into one site).
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import date
from statistics import mean, median

from .earthengine import init_ee

SO2 = "COPERNICUS/S5P/OFFL/L3_SO2"
NO2 = "COPERNICUS/S5P/OFFL/L3_NO2"
GPPD = "WRI/GPPD/power_plants"
GASES = {"so2": (SO2, "SO2_column_number_density"), "no2": (NO2, "tropospheric_NO2_column_number_density")}
BBOX = [72.4, 15.5, 81.0, 22.2]           # Maharashtra and surroundings
START_YEAR = 2019
NEAR_KM, RING_KM = 10, (40, 80)
MAX_CLOUD = 0.3
UMOL = 1e6                                  # mol/m2 -> µmol/m2
MIN_NO2_FOR_RATIO = 15.0                    # µmol/m2; below this the ratio is noise
DRY_MONTHS = (1, 2, 3, 4, 5)                # clear skies, no monsoon washout: compare years on these months
SO2_DETECTED, SO2_HIGH = 40.0, 150.0        # µmol/m2, mean over the period (default: last 12 months)
RISING = 0.25                               # latest dry season vs the 2021-2024 dry seasons

_N = "Jul 2025 notification as reported by The News Dirt (16 Jul 2025)"
SITES = {
    "chandrapur": {"name": "Chandrapur STPS + Dhariwal", "kind": "Coal power", "district": "Chandrapur",
                   "lon": 79.27, "lat": 20.007, "mw": 3940,
                   "members": "Mahagenco Chandrapur STPS (3,340 MW in GPPD; 2,920 MW now), Dhariwal Tadali (600 MW)",
                   "fgd": "no",
                   "fgd_note": f"Category B, case-by-case ({_N}). No scrubber in service by Jun 2026: the plant's own "
                               "stack readings stay at full SO₂ (see official record). CSTPS asked for a review of its "
                               "SO₂ norm in Jan 2026; the expert committee met on 21 May 2026.",
                   "official": "Stack SO₂ 1,200–1,330 mg/Nm³ on every unit, every month Jan 2024 – Jun 2026, against a "
                               "limit of 200 (500 MW units) and 600 (210 MW units): about 6 times the limit. Stack "
                               "SO₂ ÷ NOx (molar) 2.8–3.2.",
                   "official_source": "Mahagenco, CSTPS six-monthly EC compliance reports to MoEF&CC, Jan 2024 – "
                                      "Jun 2026 (stack monitoring annexure; Jul–Dec 2025 report not online)"},
    "koradi": {"name": "Koradi + Khaparkheda", "kind": "Coal power", "district": "Nagpur", "lon": 79.106,
               "lat": 21.262, "mw": 3740,
               "members": "Mahagenco Koradi (2,400 MW), Mahagenco Khaparkheda (1,340 MW), 4 km apart",
               "fgd": "planned",
               "fgd_note": f"Exempt, over 10 km from Nagpur ({_N}). FGD for Koradi units 8–10 still to be built "
                           "(see official record).",
               "official": "No scrubber yet. The Nov 2023 FGD contract for units 8–10 was terminated when the vendor did "
                           "not submit a performance bank guarantee; a new tender (wet limestone FGD) was floated on "
                           "11 Jun 2025 and bids are under scrutiny. Deadline 31 Dec 2027.",
               "official_source": "Mahagenco, Koradi TPS 3×660 MW EC compliance report to MoEF&CC, status Dec 2025"},
    "tiroda": {"name": "Tiroda (Adani)", "kind": "Coal power", "district": "Gondia", "lon": 79.9671, "lat": 21.4129,
               "mw": 3300, "members": "Adani Power Tiroda (3,300 MW)", "fgd": "no",
               "fgd_note": f"Category C, exempt ({_N})."},
    "mauda": {"name": "Mauda (NTPC)", "kind": "Coal power", "district": "Nagpur", "lon": 79.3978, "lat": 21.1797,
              "mw": 2320, "members": "NTPC Mauda (2,320 MW)", "fgd": "yes", "fgd_date": "2025-01",
              "fgd_note": f"Category C, exempt ({_N}), but NTPC built wet limestone FGD anyway (Mitsubishi Power "
                          "contract, 2018). The satellite ratio falls from early 2025 (the check date used here).",
              "official": "\"FGD system for Unit-3 & 4 is in service\" (Stage II, 2×660 MW of the 2,320 MW). The report "
                          "also confirms Mauda is Category C.",
              "official_source": "NTPC, Mauda STPP Stage-II half-yearly EC compliance report to MoEF&CC, status "
                                 "31 Mar 2026"},
    "bhusawal": {"name": "Bhusawal (Deepnagar)", "kind": "Coal power", "district": "Jalgaon", "lon": 75.8425,
                 "lat": 21.0483, "mw": 1420, "members": "Mahagenco Bhusawal (1,420 MW in GPPD)", "fgd": None,
                 "fgd_note": "Mahagenco listed Bhusawal 500 MW units for FGD in Jan–Jul 2026 (annual report "
                             "2023-24); status not confirmed."},
    "parli": {"name": "Parli", "kind": "Coal power", "district": "Beed", "lon": 76.5254, "lat": 18.8685, "mw": 1380,
              "members": "Mahagenco Parli (1,380 MW in GPPD)", "fgd": None,
              "fgd_note": "Tender floated for wet FGD on units 6–7 (Mahagenco annual report 2024-25)."},
    "amravati": {"name": "Amravati (RattanIndia)", "kind": "Coal power", "district": "Amravati", "lon": 77.9009,
                 "lat": 21.0782, "mw": 1350, "members": "RattanIndia Amravati (1,350 MW)", "fgd": "no",
                 "fgd_note": f"Exempt ({_N})."},
    "ratnagiri": {"name": "JSW Ratnagiri (Jaigad)", "kind": "Coal power", "district": "Ratnagiri", "lon": 73.212,
                  "lat": 17.297, "mw": 1200, "members": "JSW Energy Ratnagiri (1,200 MW)", "fgd": None,
                  "fgd_note": "Not checked."},
    "warora": {"name": "Warora (GMR + Sai Wardha)", "kind": "Coal power", "district": "Chandrapur", "lon": 78.979,
               "lat": 20.2725, "mw": 1140, "members": "GMR Warora (600 MW), Sai Wardha Warora (540 MW), same site",
               "fgd": "no", "fgd_note": f"Exempt ({_N})."},
    "nashik": {"name": "Nashik (Eklahare)", "kind": "Coal power", "district": "Nashik", "lon": 73.8896,
               "lat": 19.9817, "mw": 630, "members": "Mahagenco Nashik (630 MW in GPPD)", "fgd": None,
               "fgd_note": "Not checked."},
    "butibori": {"name": "Butibori", "kind": "Coal power", "district": "Nagpur", "lon": 78.9333, "lat": 20.9286,
                 "mw": 600, "members": "Butibori TPP II (600 MW)", "fgd": "no", "fgd_note": f"Exempt ({_N})."},
    "paras": {"name": "Paras", "kind": "Coal power", "district": "Akola", "lon": 76.7948, "lat": 20.7147, "mw": 500,
              "members": "Mahagenco Paras units 3–4 (2×250 MW)", "fgd": "planned", "fgd_date": "2026-04",
              "fgd_note": f"Category B, 5 km from Akola ({_N}). FGD on units 3–4 69% complete, targeted Apr 2026 "
                          "(Mahagenco annual report 2024-25); commissioning not confirmed."},
    "dahanu": {"name": "Dahanu (Adani)", "kind": "Coal power", "district": "Palghar", "lon": 72.7478, "lat": 19.9545,
               "mw": 500, "members": "Adani Dahanu (2×250 MW)", "fgd": "yes",
               "fgd_note": "Seawater FGD on both units, ordered 2005 (Ducon; Power Engineering). A reference plant "
                           "with a scrubber."},
    "trombay": {"name": "Trombay–Chembur", "kind": "Power + refineries", "district": "Mumbai", "lon": 72.8983,
                "lat": 19.0004, "mw": 750,
                "members": "Tata Power Trombay (750 MW coal), BPCL and HPCL refineries, RCF fertiliser complex",
                "fgd": "yes", "fgd_note": "Tata Power runs a seawater FGD (MPCB consent 2012). Refineries and RCF "
                                          "are in the same satellite footprint; Mumbai's traffic adds NO₂."},
    "tarapur": {"name": "Tarapur MIDC", "kind": "Industrial cluster", "district": "Palghar", "lon": 72.72,
                "lat": 19.81, "mw": None, "members": "~1,300 chemical, pharma and steel units (CEPI score 93.7)",
                "fgd": None, "fgd_note": "Critically polluted area (CPCB CEPI). Dahanu power plant is 16 km north."},
    "taloja": {"name": "Taloja MIDC", "kind": "Industrial cluster", "district": "Raigad", "lon": 73.115,
               "lat": 19.07, "mw": None, "members": "Chemical, pharma and steel units (Navi Mumbai CEPI area)",
               "fgd": None, "fgd_note": "Part of the Navi Mumbai critically polluted area (CPCB CEPI)."},
    "ghugus": {"name": "Ghugus–Rajura cement belt", "kind": "Cement cluster", "district": "Chandrapur", "lon": 79.15,
               "lat": 19.78, "mw": None,
               "members": "UltraTech Awarpur, Ambuja Maratha, Manikgarh, ACC Chanda cement plants",
               "fgd": None, "fgd_note": "Cement is under the Carbon Credit Trading Scheme intensity targets "
                                        "(Oct 2025). Chandrapur STPS is 25 km north."},
}

SOURCES = [
    {"key": "so2", "dataset": "Sentinel-5P TROPOMI offline L3 SO₂ column", "provider": "ESA / Copernicus",
     "source": SO2, "resolution_m": 1113, "license": "Copernicus open licence",
     "used_for": "SO₂ above local background, per site and month"},
    {"key": "no2", "dataset": "Sentinel-5P TROPOMI offline L3 tropospheric NO₂ column", "provider": "ESA / Copernicus",
     "source": NO2, "resolution_m": 1113, "license": "Copernicus open licence",
     "used_for": "NO₂ above local background: how hard the plant runs; denominator of the scrubber ratio"},
    {"key": "gppd", "dataset": "Global Power Plant Database v1.3", "provider": "World Resources Institute",
     "source": GPPD, "license": "CC BY 4.0", "used_for": "Plant locations and capacity (2018 snapshot)"},
    {"key": "chen", "dataset": "Chen et al. (2026), super-resolution SO₂ emissions over India from TROPOMI",
     "provider": "Atmospheric Measurement Techniques 19, 2737", "source": "amt.copernicus.org/articles/19/2737/2026",
     "license": "CC BY 4.0", "used_for": "Evidence that plant-level SO₂ is visible from TROPOMI (95% of plants "
                                         "above 1,000 MW detected)"},
    {"key": "fgd", "dataset": "MoEFCC notification on SO₂ norms for thermal plants, 11 Jul 2025",
     "provider": "Ministry of Environment, Forest and Climate Change", "source":
     "healthpolicy-watch.news; thenewsdirt.com (plant categories)", "license": "Public",
     "used_for": "Which plants are exempt from FGD (Category C) or reviewed case by case (Category B)"},
    {"key": "mahagenco", "dataset": "Mahagenco annual reports 2023-24 and 2024-25; CSTPS EC compliance report "
     "Jan–Jun 2026", "provider": "Maharashtra State Power Generation Co.", "source": "mahagenco.in",
     "license": "Public", "used_for": "Planned FGD dates for Koradi, Paras, Chandrapur, Bhusawal, Parli"},
    {"key": "fgdsites", "dataset": "Plant scrubber status: The Live Nagpur (23 Oct 2026) and Mitsubishi Power on NTPC "
     "Mauda; Power Engineering on Dahanu seawater FGD; MPCB consent (2012) for Tata Power Trombay",
     "provider": "News and company sources", "source": "thelivenagpur.com; power.mhi.com; power-eng.com; mpcb.gov.in",
     "license": "Public", "used_for": "Reference plants with scrubbers (Mauda, Dahanu, Trombay)"},
    {"key": "official", "dataset": "Official cross-checks: Mahagenco CSTPS and Koradi EC compliance reports; NTPC "
     "Mauda Stage-II EC compliance report (to MoEF&CC)", "provider": "Mahagenco; NTPC", "source":
     "mahagenco.in/EC-Compliance-report; ntpc.co.in/about-us/corporate-functions/environment/status-hyc-reports",
     "license": "Public", "used_for": "Validation: plant's own stack SO₂ (Chandrapur), scrubber status (Koradi, Mauda)"},
    {"key": "cepi", "dataset": "CPCB Comprehensive Environmental Pollution Index action plans (2020)",
     "provider": "Central Pollution Control Board", "source": "cpcb.gov.in/industrial_pollution",
     "license": "Public", "used_for": "Critically polluted industrial clusters (Tarapur, Navi Mumbai, Chandrapur)"},
]

METHOD = {
    "sites": "Coal plants of 500 MW or more from the Global Power Plant Database, plus three CPCB critically polluted "
             "clusters and Chandrapur's cement belt. Plants closer than ~10 km are one site: the satellite cannot "
             "separate them.",
    "enhancement": f"Monthly mean column within {NEAR_KM} km of the site minus the median in a {RING_KM[0]}–"
                   f"{RING_KM[1]} km ring (regional background). TROPOMI offline L3, cloud fraction under "
                   f"{MAX_CLOUD}. Units: µmol/m².",
    "years": "Years are compared on January–May only: clear skies and no monsoon washout.",
    "status": f"Check first: SO₂ above background of {SO2_HIGH:.0f}+ µmol/m² over the chosen period (default: last 12 "
              f"months), or the latest January–May in the period "
              f"{RISING:.0%}+ above 2021-2024. Watch: {SO2_DETECTED:.0f}+ µmol/m². Low: below that, within the "
              "noise of a monthly mean.",
    "scrubber": "SO₂ ÷ NO₂ above background, before vs after a date, minus the median change at plants without "
                "scrubbers (exempt plants, and Chandrapur per its own stack readings). A scrubber cuts SO₂ but not NO₂.",
    "validation": "Checked against official filings to MoEF&CC. Chandrapur's own stack readings show SO₂ about 6 times "
                  "the limit every month of 2024-2026 (flagged 'check first' here) and no scrubber; its stack SO₂ ÷ NOx "
                  "(2.8-3.2) matches the satellite level (2.2-2.9), but the satellite ratio drifts down ~10-15% over "
                  "2023-2026 while the stack ratio stays flat, which is why the scrubber check subtracts plants without "
                  "scrubbers. NTPC confirms Mauda's Stage-II scrubbers in service (Mar 2026); Mahagenco confirms Koradi "
                  "has none yet (Dec 2025), matching the satellite.",
    "limits": "Columns, not stack concentrations: no verdict on the mg/Nm³ norm. One overpass a day (~13:30), so "
              "night releases are missed. Sites a few km apart are merged. Retrieval changes and coal sulphur "
              "content also move the numbers, so a change is a reason to inspect, not proof.",
}


def months_since(year: int, today: date | None = None) -> list[tuple[int, int]]:
    """Every month from January of `year` to the last complete month."""
    t = today or date.today()
    last = (t.year, t.month - 1) if t.month > 1 else (t.year - 1, 12)
    out, (y, m) = [], (year, 1)
    while (y, m) <= last:
        out.append((y, m))
        y, m = (y, m + 1) if m < 12 else (y + 1, 1)
    return out


def _site_fc(ee):
    near, ring = [], []
    for sid, s in SITES.items():
        p = ee.Geometry.Point([s["lon"], s["lat"]])
        near.append(ee.Feature(p.buffer(NEAR_KM * 1000), {"id": sid}))
        ring.append(ee.Feature(p.buffer(RING_KM[1] * 1000).difference(p.buffer(RING_KM[0] * 1000), 500), {"id": sid}))
    return ee.FeatureCollection(near), ee.FeatureCollection(ring)


def _monthly_stack(ee, gas: str, months: list[tuple[int, int]]):
    col_id, band = GASES[gas]
    region = ee.Geometry.Rectangle(BBOX, None, False)
    imgs = []
    for y, m in months:
        start = ee.Date.fromYMD(y, m, 1)
        imgs.append(ee.ImageCollection(col_id).filterBounds(region).filterDate(start, start.advance(1, "month"))
                    .map(lambda i: i.select(band).updateMask(i.select("cloud_fraction").lt(MAX_CLOUD)))
                    .mean().rename(f"{gas}_{y}{m:02d}"))
    return ee.Image.cat(imgs)


def _year_values(gas: str, months: list[tuple[int, int]]) -> dict[str, dict[str, float | None]]:
    """{site: {YYYYMM: enhancement µmol/m2}} for one gas and a block of months (one Earth Engine call each)."""
    ee = init_ee()
    near, ring = _site_fc(ee)
    stack = _monthly_stack(ee, gas, months)
    a = stack.reduceRegions(near, ee.Reducer.mean(), 2000, tileScale=4).getInfo()
    b = stack.reduceRegions(ring, ee.Reducer.median(), 4000, tileScale=4).getInfo()
    rings = {f["properties"]["id"]: f["properties"] for f in b["features"]}
    out = {}
    for f in a["features"]:
        p, r = f["properties"], rings[f["properties"]["id"]]
        vals = {}
        for y, m in months:
            k = f"{gas}_{y}{m:02d}"
            vals[f"{y}{m:02d}"] = (round((p[k] - r[k]) * UMOL, 1)
                                   if p.get(k) is not None and r.get(k) is not None else None)
        out[p["id"]] = vals
    return out


def monthly_enhancements(months: list[tuple[int, int]], progress=None) -> dict[str, dict[str, dict]]:
    """{site: {"so2": {YYYYMM: v}, "no2": {YYYYMM: v}}}, fetched year by year in parallel."""
    blocks = {}
    for y, m in months:
        blocks.setdefault(y, []).append((y, m))
    tasks = [(gas, b) for gas in GASES for b in blocks.values()]
    out: dict[str, dict[str, dict]] = {sid: {g: {} for g in GASES} for sid in SITES}
    with ThreadPoolExecutor(max_workers=4) as pool:
        for n, ((gas, _), res) in enumerate(zip(tasks, pool.map(lambda t: _year_values(*t), tasks)), start=1):
            for sid, vals in res.items():
                out[sid][gas].update(vals)
            if progress:
                progress(n, len(tasks))
    return out


def _avg(vals):
    vals = [v for v in vals if v is not None]
    return round(mean(vals), 1) if vals else None


def _ratio(so2, no2):
    return round(so2 / no2, 2) if so2 is not None and no2 is not None and no2 >= MIN_NO2_FOR_RATIO else None


def summarise(sid: str, data: dict, months: list[tuple[int, int]], period: tuple[str, str] | None = None) -> dict:
    """Monthly series, dry-season yearly values, level over the period, trend and status for one site.

    `period` is (first, last) as "YYYY-MM"; by default the last 12 months. The level is the mean over the period; the
    trend compares the latest January-May inside the period with 2021-2024.
    """
    keys = [f"{y}{m:02d}" for y, m in months]
    series = [{"month": f"{k[:4]}-{k[4:]}", "so2": data["so2"].get(k), "no2": data["no2"].get(k),
               "ratio": _ratio(data["so2"].get(k), data["no2"].get(k))} for k in keys]
    if period is None:
        period = (series[-min(12, len(series))]["month"], series[-1]["month"])
    first, last = period[0].replace("-", ""), period[1].replace("-", "")
    window = [k for k in keys if first <= k <= last]
    dry = []
    for y in sorted({y for y, _ in months}):
        ks = [f"{y}{m:02d}" for m in DRY_MONTHS if f"{y}{m:02d}" in data["so2"]]
        if len(ks) < 3:
            continue
        so2, no2 = _avg(data["so2"][k] for k in ks), _avg(data["no2"][k] for k in ks)
        dry.append({"year": y, "so2": so2, "no2": no2, "ratio": _ratio(so2, no2), "from": min(ks), "to": max(ks)})
    so2_lvl, no2_lvl = _avg(data["so2"].get(k) for k in window), _avg(data["no2"].get(k) for k in window)
    base = [d["so2"] for d in dry if 2021 <= d["year"] <= 2024 and d["so2"] is not None]
    in_period = [d for d in dry if first <= d["from"] and d["to"] <= last]
    latest_dry = in_period[-1] if in_period else None
    change = (round((latest_dry["so2"] - mean(base)) / mean(base), 3)
              if latest_dry and base and latest_dry["so2"] is not None and mean(base) > SO2_DETECTED else None)
    reasons = []
    if so2_lvl is not None and so2_lvl >= SO2_HIGH:
        reasons.append("high SO₂")
    if change is not None and change >= RISING:
        reasons.append("SO₂ rising")
    status = ("check first" if reasons else "watch" if (so2_lvl or 0) >= SO2_DETECTED
              else "low" if so2_lvl is not None else "no data")
    s = SITES[sid]
    return {"id": sid, "name": s["name"], "kind": s["kind"], "district": s["district"], "mw": s["mw"],
            "members": s["members"], "fgd": s["fgd"], "fgd_date": s.get("fgd_date"), "fgd_note": s["fgd_note"],
            "official": s.get("official"), "official_source": s.get("official_source"),
            "lat": s["lat"], "lon": s["lon"], "period": {"start": period[0], "end": period[1], "months": len(window)},
            "so2_mean": so2_lvl, "no2_mean": no2_lvl, "ratio_mean": _ratio(so2_lvl, no2_lvl),
            "dry": [{k: v for k, v in d.items() if k not in ("from", "to")} for d in dry],
            "dry_year": latest_dry["year"] if latest_dry else None,
            "so2_change": change, "series": series, "reasons": reasons, "status": status}


def resummarise(results: dict[str, dict], start: str, end: str) -> dict[str, dict]:
    """Recompute every site for a new period from the monthly series already stored with a check."""
    out = {}
    for sid, r in results.items():
        months = [(int(p["month"][:4]), int(p["month"][5:])) for p in r["series"]]
        data = {g: {p["month"].replace("-", ""): p[g] for p in r["series"]} for g in ("so2", "no2")}
        out[sid] = summarise(sid, data, months, (start, end))
    return out


def scrubber_check(results: dict[str, dict], sid: str, on: str, before: int = 12, after: int | None = None) -> dict:
    """SO2/NO2 ratio before vs after `on` (YYYY-MM) at `sid`, against the median change at exempt plants."""
    def window(r):
        ser = r["series"]
        idx = next((i for i, s in enumerate(ser) if s["month"] >= on), len(ser))
        pre, post = ser[max(0, idx - before):idx], ser[idx: idx + after if after else None]
        so2_b, no2_b = _avg(s["so2"] for s in pre), _avg(s["no2"] for s in pre)
        so2_a, no2_a = _avg(s["so2"] for s in post), _avg(s["no2"] for s in post)
        return {"months_before": len(pre), "months_after": len(post), "so2_before": so2_b, "so2_after": so2_a,
                "no2_before": no2_b, "no2_after": no2_a, "ratio_before": _ratio(so2_b, no2_b),
                "ratio_after": _ratio(so2_a, no2_a)}

    def change(w):
        if w["ratio_before"] and w["ratio_after"] is not None:
            return round(w["ratio_after"] / w["ratio_before"] - 1, 3)
        return None

    site = window(results[sid])
    controls = {k: change(window(r)) for k, r in results.items() if r["fgd"] == "no" and k != sid}
    ctl = [v for v in controls.values() if v is not None]
    site["ratio_change"] = change(site)
    site["control_change"] = round(median(ctl), 3) if ctl else None
    site["controls"] = controls
    site["net_change"] = (round(site["ratio_change"] - site["control_change"], 3)
                          if site["ratio_change"] is not None and site["control_change"] is not None else None)
    return site


def map_image(gas: str, months: list[tuple[int, int]]):
    """Mean column over the given months, coloured, for a map overlay."""
    ee = init_ee()
    col_id, band = GASES[gas]
    (y0, m0), (y1, m1) = months[0], months[-1]
    end = ee.Date.fromYMD(y1, m1, 1).advance(1, "month")
    img = (ee.ImageCollection(col_id).filterBounds(ee.Geometry.Rectangle(BBOX, None, False))
           .filterDate(ee.Date.fromYMD(y0, m0, 1), end)
           .map(lambda i: i.select(band).updateMask(i.select("cloud_fraction").lt(MAX_CLOUD))).mean().multiply(UMOL))
    lo, hi = (100, 600) if gas == "so2" else (30, 120)
    palette = ["fff5eb", "fdd0a2", "fd8d3c", "d94801", "7f2704"] if gas == "so2" else \
              ["f7fcfd", "bfd3e6", "8c96c6", "88419d", "4d004b"]
    return img.updateMask(img.gt(lo)).visualize(min=lo, max=hi, palette=palette, opacity=0.75), (lo, hi, palette)
