"""HTTP API and static web app."""

from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import air, auth
from .config import REPO_ROOT, settings
from .jobs import Job, is_valid_job_id, list_jobs
from .pipelines import STAGES, run_state_job

FILENAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$")
MONTH_RE = re.compile(r"^20\d\d-(0[1-9]|1[0-2])$")

app = FastAPI(title="Udyog-drishti AI", version="0.1.0", dependencies=[Depends(auth.require_user)])
auth.register(app)
executor = ThreadPoolExecutor(max_workers=2)


@app.on_event("startup")
def recover_interrupted_jobs() -> None:
    for j in list_jobs():
        if j["status"] in ("queued", "running"):
            job = Job.load(j["id"])
            job.event("error", "JOB_INTERRUPTED", "The server restarted while this check was running",
                      action="Start the check again")
            job.set_status("failed")


class StateRequest(BaseModel):
    start_year: int = air.START_YEAR


def _load(job_id: str) -> Job:
    if not is_valid_job_id(job_id):
        raise HTTPException(404, "Check not found")
    try:
        return Job.load(job_id)
    except FileNotFoundError:
        raise HTTPException(404, "Check not found") from None


def _results(j: Job) -> dict | None:
    p = j.path("results.json")
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "gee_project_configured": bool(settings.gee_project)}


@app.get("/api/sites")
def sites() -> list[dict]:
    return [{"id": k, **v} for k, v in air.SITES.items()]


@app.post("/api/jobs/state")
def create_state(body: StateRequest) -> dict:
    if not 2019 <= body.start_year <= 2025:
        raise HTTPException(400, "Start year must be between 2019 and 2025")
    job = Job.create("Maharashtra plants and clusters", "state", STAGES, {"start_year": body.start_year})
    executor.submit(run_state_job, job)
    return {"id": job.id}


@app.get("/api/jobs")
def jobs() -> list[dict]:
    out = []
    for j in list_jobs():
        s = dict(j.get("summary") or {})
        s.pop("method", None)
        out.append({**j, "summary": s})
    return out


@app.get("/api/jobs/{job_id}")
def job(job_id: str) -> dict:
    j = _load(job_id)
    return {**j.state, "events": j.events(), "results": _results(j)}


@app.get("/api/jobs/{job_id}/scrubber")
def scrubber(job_id: str, site: str, on: str, before: int = 12) -> dict:
    results = _results(_load(job_id))
    if results is None or site not in results:
        raise HTTPException(404, "Site not found in this check")
    if not MONTH_RE.fullmatch(on) or not 6 <= before <= 36:
        raise HTTPException(400, "Use a month like 2025-01 and 6-36 months before")
    return air.scrubber_check(results, site, on, before)


@app.get("/api/jobs/{job_id}/files/{filename}")
def job_file(job_id: str, filename: str, download: bool = False):
    j = _load(job_id)
    allowed = {v["file"] for group in j.state["outputs"].values() for v in group.values()}
    if not FILENAME_RE.fullmatch(filename) or filename not in allowed or not j.path(filename).is_file():
        raise HTTPException(404, "File not found")
    return FileResponse(j.path(filename), filename=filename if download else None)


_dist = REPO_ROOT / "frontend" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="frontend")
