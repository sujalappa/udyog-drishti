from datetime import date

from udyogdrishti import air
from udyogdrishti.exports import write_kml


def _data(so2, no2, months):
    return {"so2": {f"{y}{m:02d}": so2(y, m) for y, m in months}, "no2": {f"{y}{m:02d}": no2(y, m) for y, m in months}}


def test_months_since_stops_at_last_complete_month():
    months = air.months_since(2025, today=date(2026, 1, 15))
    assert months[0] == (2025, 1) and months[-1] == (2025, 12) and len(months) == 12


def test_summarise_flags_high_and_rising_so2():
    months = air.months_since(2021, today=date(2026, 10, 1))
    high = air.summarise("tiroda", _data(lambda y, m: 200.0, lambda y, m: 40.0, months), months)
    assert high["status"] == "check first" and high["reasons"] == ["high SO₂"] and high["ratio_12m"] == 5.0
    rising = air.summarise("parli", _data(lambda y, m: 100.0 if y == 2026 else 60.0, lambda y, m: 30.0, months), months)
    assert "SO₂ rising" in rising["reasons"] and rising["so2_change"] > 0.25
    low = air.summarise("nashik", _data(lambda y, m: 10.0, lambda y, m: 20.0, months), months)
    assert low["status"] == "low" and low["reasons"] == []


def test_ratio_needs_enough_no2():
    assert air._ratio(100.0, 5.0) is None
    assert air._ratio(100.0, 20.0) == 5.0


def test_scrubber_check_is_relative_to_exempt_plants():
    months = air.months_since(2024, today=date(2026, 1, 1))
    def site(y, m):
        return 100.0 if y == 2025 else 300.0          # SO2 falls by two thirds in 2025
    results = {
        "mauda": air.summarise("mauda", _data(site, lambda y, m: 60.0, months), months),
        "tiroda": air.summarise("tiroda", _data(lambda y, m: 270.0 if y == 2025 else 300.0, lambda y, m: 60.0, months),
                                months),
        "warora": air.summarise("warora", _data(lambda y, m: 270.0 if y == 2025 else 300.0, lambda y, m: 60.0, months),
                                months),
    }
    c = air.scrubber_check(results, "mauda", "2025-01")
    assert c["ratio_before"] == 5.0 and c["ratio_after"] == round(100 / 60, 2)
    assert c["control_change"] == -0.1
    assert c["net_change"] < -0.5
    assert set(c["controls"]) == {"tiroda", "warora"}


def test_kml_writes_points(tmp_path):
    fc = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"id": "a", "name": "Site A"}, "geometry": {"type": "Point",
                                                                                     "coordinates": [79.1, 21.2]}}]}
    path = tmp_path / "s.kml"
    write_kml(path, fc, {"a": {"status": "watch"}}, "name", [("status", "Status")], lambda r: "ff00a5ff")
    text = path.read_text(encoding="utf-8")
    assert "<Point><coordinates>79.10000,21.20000</coordinates></Point>" in text and "<IconStyle>" in text


def test_every_site_is_described():
    for sid, s in air.SITES.items():
        assert s["fgd"] in ("yes", "no", "planned", None), sid
        assert s["fgd_note"] and s["members"] and 15 < s["lat"] < 23 and 72 < s["lon"] < 81
