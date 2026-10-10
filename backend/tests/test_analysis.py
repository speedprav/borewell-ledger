"""
test_analysis.py - Unit tests for the deterministic analysis engine.
Tests slope math, status thresholds, peer selection, area alerts, validation, dry-out estimate.
"""
import sys
import os
# Add backend/ as root so imports work without 'backend.' prefix
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))

import pytest
from datetime import date, timedelta
from decimal import Decimal

# Set dummy env vars before importing common modules
os.environ.setdefault("WELLS_TABLE", "test")
os.environ.setdefault("READINGS_TABLE", "test")
os.environ.setdefault("ALERTS_TABLE", "test")
os.environ.setdefault("META_TABLE", "test")
os.environ.setdefault("SNS_TOPIC_ARN", "test")

from common.analysis import (
    compute_slope_mpm,
    classify_status,
    compute_dryout_estimate,
    detect_area_alerts,
    make_alert_id,
    check_large_jump,
    WINDOW_DAYS,
    MIN_READINGS,
    MIN_SPAN_DAYS,
)
from common.validate import (
    validate_depth,
    validate_date,
    validate_coords,
    validate_name,
)
from common.geo import haversine_km, encode_geohash, is_inside_india


# ─── Helpers ─────────────────────────────────────────────────────────────────

def make_readings(start_offset_days: int, count: int, start_depth: float,
                  slope_mpm: float, noise: float = 0.0) -> list[dict]:
    """Generate readings with given slope and optional noise."""
    from common.analysis import DAYS_PER_MONTH
    import random
    random.seed(42)
    readings = []
    today = date.today()
    for i in range(count):
        days_ago = start_offset_days - i * (start_offset_days // count)
        d = today - timedelta(days=days_ago)
        months = days_ago / DAYS_PER_MONTH
        depth = start_depth + slope_mpm * (start_offset_days / DAYS_PER_MONTH - months)
        if noise:
            depth += random.uniform(-noise, noise)
        readings.append({"date": d.isoformat(), "depthM": round(depth, 2)})
    return sorted(readings, key=lambda r: r["date"])


# ─── Slope Tests ──────────────────────────────────────────────────────────────

def test_slope_declining():
    """Slope should be positive when depth increases over time (water getting deeper)."""
    readings = make_readings(89, 10, 10.0, 0.5)
    slope = compute_slope_mpm(readings)
    assert slope is not None
    assert 0.3 < slope < 0.7, f"Expected ~0.5, got {slope}"


def test_slope_stable():
    """Slope near zero for flat depth."""
    readings = make_readings(89, 10, 15.0, 0.0)
    slope = compute_slope_mpm(readings)
    assert slope is not None
    assert abs(slope) < 0.05, f"Expected ~0.0, got {slope}"


def test_slope_recovering():
    """Negative slope when water recovers (depth decreasing)."""
    readings = make_readings(89, 10, 20.0, -0.3)
    slope = compute_slope_mpm(readings)
    assert slope is not None
    assert slope < 0, f"Expected negative slope, got {slope}"


def test_slope_insufficient_count():
    """Fewer than MIN_READINGS should return None."""
    readings = make_readings(89, MIN_READINGS - 1, 10.0, 0.5)
    slope = compute_slope_mpm(readings)
    assert slope is None


def test_slope_insufficient_span():
    """Readings within MIN_SPAN_DAYS should return None."""
    today = date.today()
    readings = [
        {"date": (today - timedelta(days=5)).isoformat(), "depthM": 10.0},
        {"date": (today - timedelta(days=3)).isoformat(), "depthM": 10.2},
        {"date": today.isoformat(), "depthM": 10.4},
    ]
    slope = compute_slope_mpm(readings)
    assert slope is None


def test_slope_outside_window():
    """Readings older than WINDOW_DAYS should be excluded."""
    today = date.today()
    old_readings = [
        {"date": (today - timedelta(days=WINDOW_DAYS + 10 + i)).isoformat(), "depthM": 5.0 + i}
        for i in range(10)
    ]
    slope = compute_slope_mpm(old_readings)
    assert slope is None


def test_slope_future_readings_excluded():
    """Future dates should be excluded."""
    today = date.today()
    readings = [
        {"date": (today - timedelta(days=60)).isoformat(), "depthM": 10.0},
        {"date": (today - timedelta(days=30)).isoformat(), "depthM": 10.5},
        {"date": (today + timedelta(days=10)).isoformat(), "depthM": 11.0},  # future
    ]
    slope = compute_slope_mpm(readings)
    # Should compute with only 2 readings — returns None (< MIN_READINGS of 3)
    assert slope is None


# ─── Status Tests ──────────────────────────────────────────────────────────────

def test_status_critical():
    slope = 1.0  # >= 0.8 and >= 2.5 * base
    peer_median = 0.2
    status = classify_status(slope, peer_median)
    assert status == "CRITICAL"


def test_status_critical_high_peer():
    """If peer median is also high, base = peer_median, threshold rises."""
    slope = 0.9
    peer_median = 0.5
    # base = max(0.5, 0.1) = 0.5
    # CRITICAL if slope >= 0.8 AND slope >= 2.5 * 0.5 = 1.25
    # 0.9 < 1.25 → not CRITICAL
    # WATCH if slope >= 0.3 AND slope >= 1.5 * 0.5 = 0.75
    # 0.9 >= 0.75 → WATCH
    status = classify_status(slope, peer_median)
    assert status == "WATCH"


def test_status_watch():
    slope = 0.4  # >= 0.3 and >= 1.5 * base
    peer_median = 0.15
    status = classify_status(slope, peer_median)
    assert status == "WATCH"


def test_status_normal():
    slope = 0.1
    peer_median = 0.15
    status = classify_status(slope, peer_median)
    assert status == "NORMAL"


def test_status_none_slope():
    status = classify_status(None, 0.2)
    assert status == "NOT_ENOUGH_DATA"


def test_status_none_peer():
    """No peer median: base defaults to 0.1."""
    slope = 0.9
    status = classify_status(slope, None)
    # base = 0.1, critical if >= 0.8 and >= 2.5 * 0.1 = 0.25
    assert status == "CRITICAL"


# ─── Dry-out Estimate Tests ────────────────────────────────────────────────────

def test_dryout_basic():
    result = compute_dryout_estimate(60.0, 40.0, 0.5)
    assert result is not None
    assert result["monthsLow"] == pytest.approx(40.0 * 0.7, abs=0.2)
    assert result["monthsHigh"] == pytest.approx(40.0 * 1.3, abs=0.2)


def test_dryout_already_reached():
    result = compute_dryout_estimate(30.0, 35.0, 0.5)
    assert result is not None
    assert result["monthsLow"] == 0.0


def test_dryout_no_pump_depth():
    result = compute_dryout_estimate(None, 35.0, 0.5)
    assert result is None


def test_dryout_recovering():
    """Negative slope: not computable."""
    result = compute_dryout_estimate(60.0, 40.0, -0.3)
    assert result is None


# ─── Area Alert Tests ──────────────────────────────────────────────────────────

def test_area_alert_triggered():
    """5+ wells in same locality with median >= 0.5 should trigger area alert."""
    wells = [
        {"wellId": f"w{i}", "locality": "Alkapuri", "lat": 22.3 + i * 0.01,
         "lon": 73.2 + i * 0.01, "slopeMPerMonth": 0.6 + i * 0.05}
        for i in range(6)
    ]
    alerts = detect_area_alerts(wells)
    assert len(alerts) == 1
    assert alerts[0]["locality"] == "Alkapuri"


def test_area_alert_not_enough_wells():
    """Fewer than 5 wells should not trigger."""
    wells = [
        {"wellId": f"w{i}", "locality": "Small", "lat": 22.3, "lon": 73.2,
         "slopeMPerMonth": 0.8}
        for i in range(4)
    ]
    alerts = detect_area_alerts(wells)
    assert len(alerts) == 0


def test_area_alert_low_slope():
    """Median slope < 0.5 should not trigger."""
    wells = [
        {"wellId": f"w{i}", "locality": "LowSlope", "lat": 22.3 + i * 0.01,
         "lon": 73.2, "slopeMPerMonth": 0.1 + i * 0.01}
        for i in range(6)
    ]
    alerts = detect_area_alerts(wells)
    assert len(alerts) == 0


# ─── Large Jump Tests ─────────────────────────────────────────────────────────

def test_large_jump_detected():
    assert check_large_jump(15.0, 10.0) is True


def test_large_jump_small_change():
    assert check_large_jump(11.0, 10.0) is False


def test_large_jump_no_previous():
    assert check_large_jump(15.0, None) is False


# ─── Alert ID Determinism ─────────────────────────────────────────────────────

def test_alert_id_deterministic():
    id1 = make_alert_id("WELL", "well-123", "CRITICAL")
    id2 = make_alert_id("WELL", "well-123", "CRITICAL")
    assert id1 == id2


def test_alert_id_different():
    id1 = make_alert_id("WELL", "well-123", "CRITICAL")
    id2 = make_alert_id("WELL", "well-456", "CRITICAL")
    assert id1 != id2


# ─── Validation Tests ─────────────────────────────────────────────────────────

def test_validate_depth_valid():
    depth, err = validate_depth(45.5)
    assert err is None
    assert depth == 45.5


def test_validate_depth_out_of_range():
    _, err = validate_depth(400)
    assert err is not None


def test_validate_depth_negative():
    _, err = validate_depth(-1)
    assert err is not None


def test_validate_date_valid():
    d, err = validate_date(date.today().isoformat())
    assert err is None
    assert d == date.today()


def test_validate_date_future():
    future = (date.today() + timedelta(days=1)).isoformat()
    _, err = validate_date(future)
    assert err is not None


def test_validate_date_too_old():
    old = (date.today() - timedelta(days=365 * 6)).isoformat()
    _, err = validate_date(old)
    assert err is not None


def test_validate_coords_india():
    coords, err = validate_coords(22.3, 73.2)
    assert err is None


def test_validate_coords_outside_india():
    _, err = validate_coords(51.5, -0.1)  # London
    assert err is not None


# ─── Geo Tests ────────────────────────────────────────────────────────────────

def test_haversine_zero():
    dist = haversine_km(22.3, 73.2, 22.3, 73.2)
    assert dist == pytest.approx(0.0, abs=0.01)


def test_haversine_known_distance():
    """Roughly 1.57 km between two nearby points."""
    dist = haversine_km(22.3, 73.2, 22.31, 73.21)
    assert 1.0 < dist < 2.5


def test_geohash_length():
    h = encode_geohash(22.3072, 73.1812, precision=5)
    assert len(h) == 5


def test_india_bounding_box():
    assert is_inside_india(22.3, 73.2) is True
    assert is_inside_india(51.5, -0.1) is False
    assert is_inside_india(0.0, 0.0) is False


# ─── AI JSON Parsing Fallback ─────────────────────────────────────────────────

def test_template_analyze_not_enough_data():
    from common.templates import template_analyze
    well = {"name": "Test Well", "status": "NOT_ENOUGH_DATA", "slopeMPerMonth": None}
    result = template_analyze(well, [], {})
    assert "advisorySource" in result
    assert result["advisorySource"] == "template"
    assert "nextSteps" in result
    assert len(result["possibleReasons"]) == 3


def test_template_analyze_critical():
    from common.templates import template_analyze
    well = {
        "name": "Crisis Well", "status": "CRITICAL",
        "slopeMPerMonth": 1.1, "peerMedian": 0.2, "latestDepthM": 35.0
    }
    result = template_analyze(well, [{"date": "2024-01-01", "depthM": 30.0}],
                              {"peerCount": 5})
    assert result["advisorySource"] == "template"
    assert "CRITICAL" in result["summary"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
