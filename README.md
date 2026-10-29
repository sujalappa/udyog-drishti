# Udyog-drishti AI

An independent monthly satellite check on every big coal plant and polluted industrial area in Maharashtra, from Sentinel-5P.

For each site it measures:
- **SO₂ and NO₂ above the local background:** mean column within 10 km minus the median in a 40–80 km ring, every month since 2019.
- **SO₂ ÷ NO₂:** a scrubber (FGD) removes SO₂ but not NO₂, so this ratio falls when a scrubber works, even if the plant runs harder.

It flags sites to **check first** (high SO₂, or SO₂ rising against 2021-2024). The **scrubber check** compares the ratio before and after a date with the same change at exempt plants without scrubbers.

The satellite measures columns, not stack concentrations. It gives no verdict on the mg/Nm³ norm, misses releases outside the ~13:30 overpass, and merges plants a few km apart. It tells inspectors where to look first.

## Data sources

| Dataset | Provider | Used for | Licence |
|---|---|---|---|
| Sentinel-5P TROPOMI offline L3 SO₂ and NO₂ | ESA / Copernicus | Monthly SO₂ and NO₂ per site, maps | Copernicus open licence |
| Global Power Plant Database v1.3 | WRI | Plant locations and capacity | CC BY 4.0 |
| MoEFCC notification, 11 Jul 2025 (as reported) | MoEFCC | Which plants are exempt from FGD | Public |
| Mahagenco annual reports and EC compliance reports | Mahagenco | Planned FGD dates | Public |
| CPCB CEPI action plans | CPCB | Critically polluted clusters | Public |
| Chen et al. (2026), AMT 19, 2737 | KNMI / TU Delft | Evidence that plant-level SO₂ is visible from TROPOMI | CC BY 4.0 |

## Run locally

```bash
cd frontend && npm install && npm run build && cd ..
cp .env.example .env               # set GEE_PROJECT; run `earthengine authenticate` once
cd backend && uvicorn udyogdrishti.api:app --port 8300
```

Open http://localhost:8300. Tests: `cd backend && python -m pytest tests -q`.

## Layout

- `backend/udyogdrishti/air.py`: sites, monthly SO₂/NO₂ above background, flags, scrubber check
- `backend/udyogdrishti/pipelines.py`: the statewide job, maps, PDF, CSV, GeoJSON and KML
- `frontend/`: React + MapLibre web app
- `research/NOTES.md`: problem evidence, feasibility test and sources
- `presentation/`: Seva Innovation Challenge 2026 deck
