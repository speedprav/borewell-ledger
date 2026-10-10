"""
analysis.py - Core deterministic analysis engine for Borewell Ledger.
All rules documented in spec section 5.
"""
import math
from datetime import datetime, date
from typing import Optional

# ─── Constants (starting values, documented as assumptions) ──────────────────
WINDOW_DAYS = 90
MIN_READINGS = 3
MIN_SPAN_DAYS = 14
PEER_RADIUS_KM = 3.0
MIN_PEERS = 3
DAYS_PER_MONTH = 30.4375

STATUS_CRITICAL_SLOPE = 0.8
STATUS_CRITICAL_MULTIPLIER = 2.5
STATUS_WATCH_SLOPE = 0.3
STATUS_WATCH_MULTIPLIER = 1.5

AREA_ALERT_MIN_WELLS = 5
AREA_ALERT_MEDIAN_SLOPE = 0.5


def compute_slope_mpm(readings: list[dict]) -> Optional[float]:
    """
    Ordinary least squares slope of depth vs time.
    Returns slope in meters per month (positive = deeper = worse).
    Requires >= MIN_READINGS spanning >= MIN_SPAN_DAYS within WINDOW_DAYS.
    Returns None if insufficient data.

    readings: list of {"date": "yyyy-mm-dd", "depthM": float}
    sorted ascending or unsorted - we sort here.
    """
    today = date.today()
    cutoff = today.toordinal() - WINDOW_DAYS

    valid = []
    for r in readings:
        try:
            d = date.fromisoformat(r["date"])
            if d.toordinal() >= cutoff and d <= today:
                valid.append((d.toordinal(), float(r["depthM"])))
        except (KeyError, ValueError):
            continue

    if len(valid) < MIN_READINGS:
        return None

    valid.sort(key=lambda x: x[0])
    t0 = valid[0][0]
    t1 = valid[-1][0]
    if (t1 - t0) < MIN_SPAN_DAYS:
        return None

    # OLS
    n = len(valid)
    xs = [(v[0] - t0) / DAYS_PER_MONTH for v in valid]  # months from first reading
    ys = [v[1] for v in valid]                            # depth in metres

    sum_x = sum(xs)
    sum_y = sum(ys)
    sum_xy = sum(x * y for x, y in zip(xs, ys))
    sum_xx = sum(x * x for x in xs)
    denom = n * sum_xx - sum_x * sum_x

    if abs(denom) < 1e-12:
        return None

    slope = (n * sum_xy - sum_x * sum_y) / denom
    return round(slope, 4)


def classify_status(slope: Optional[float], peer_median: Optional[float]) -> str:
    """
    Returns "NORMAL", "WATCH", "CRITICAL", or "NOT_ENOUGH_DATA".
    Handles DynamoDB Decimal types by converting to float.
    """
    if slope is None:
        return "NOT_ENOUGH_DATA"

    slope = float(slope)
    base = max(float(peer_median) if peer_median is not None else 0.0, 0.1)

    if slope >= STATUS_CRITICAL_SLOPE and slope >= STATUS_CRITICAL_MULTIPLIER * base:
        return "CRITICAL"
    if slope >= STATUS_WATCH_SLOPE and slope >= STATUS_WATCH_MULTIPLIER * base:
        return "WATCH"
    return "NORMAL"


def compute_peer_stats(well: dict, all_wells: list[dict]) -> dict:
    """
    Returns {"peerMedian": float|None, "peerCount": int, "peers": [...]}
    Peers: other wells within PEER_RADIUS_KM with a computed slope.
    Handles DynamoDB Decimal types by converting to float.
    """
    from common.geo import haversine_km

    peers = []
    for w in all_wells:
        if w["wellId"] == well["wellId"]:
            continue
        if w.get("slopeMPerMonth") is None:
            continue
        try:
            dist = haversine_km(
                float(well["lat"]), float(well["lon"]),
                float(w["lat"]), float(w["lon"])
            )
        except (KeyError, TypeError, ValueError):
            continue
        if dist <= PEER_RADIUS_KM:
            peers.append({"wellId": w["wellId"], "distKm": round(dist, 2),
                          "slope": float(w["slopeMPerMonth"])})

    if len(peers) < MIN_PEERS:
        return {"peerMedian": None, "peerCount": len(peers), "peers": peers}

    slopes = sorted(p["slope"] for p in peers)
    n = len(slopes)
    if n % 2 == 1:
        median = float(slopes[n // 2])
    else:
        median = (float(slopes[n // 2 - 1]) + float(slopes[n // 2])) / 2.0

    return {"peerMedian": round(median, 4), "peerCount": n, "peers": peers}


def compute_dryout_estimate(pump_depth_m: Optional[float],
                            latest_depth_m: Optional[float],
                            slope: Optional[float]) -> Optional[dict]:
    """
    Returns {"monthsLow": float, "monthsHigh": float, "label": str}
    or None if not computable.
    Server-side only, never LLM-generated.
    Handles DynamoDB Decimal types by converting to float.
    """
    if pump_depth_m is None or latest_depth_m is None or slope is None:
        return None
    pump_depth_m = float(pump_depth_m)
    latest_depth_m = float(latest_depth_m)
    slope = float(slope)
    if slope <= 0:
        return None
    remaining = pump_depth_m - latest_depth_m
    if remaining <= 0:
        return {"monthsLow": 0.0, "monthsHigh": 0.0,
                "label": "Pump depth already reached or exceeded"}
    months_central = remaining / slope
    return {
        "monthsLow": round(months_central * 0.7, 1),
        "monthsHigh": round(months_central * 1.3, 1),
        "label": "rough estimate — assumes current rate continues"
    }


def detect_area_alerts(wells_with_slopes: list[dict]) -> list[dict]:
    """
    Group by locality. If >= AREA_ALERT_MIN_WELLS wells have slopes and
    median >= AREA_ALERT_MEDIAN_SLOPE, return an area alert dict.
    Handles DynamoDB Decimal types by converting to float.
    """
    from collections import defaultdict
    import statistics

    by_locality: dict[str, list] = defaultdict(list)
    for w in wells_with_slopes:
        if w.get("slopeMPerMonth") is not None and w.get("locality"):
            by_locality[w["locality"]].append(w)

    area_alerts = []
    for locality, wells in by_locality.items():
        slopes = [float(w["slopeMPerMonth"]) for w in wells]
        if len(slopes) < AREA_ALERT_MIN_WELLS:
            continue
        med = statistics.median(slopes)
        if med < AREA_ALERT_MEDIAN_SLOPE:
            continue

        # Centroid
        lats = [float(w["lat"]) for w in wells]
        lons = [float(w["lon"]) for w in wells]
        centroid_lat = round(sum(lats) / len(lats), 4)
        centroid_lon = round(sum(lons) / len(lons), 4)

        area_alerts.append({
            "locality": locality,
            "wellCount": len(wells),
            "medianSlope": round(med, 4),
            "centroidLat": centroid_lat,
            "centroidLon": centroid_lon,
        })

    return area_alerts


def make_alert_id(alert_type: str, ref_id: str, severity: str) -> str:
    """Deterministic alert ID so idempotent inserts work."""
    return f"{alert_type.lower()}-{ref_id}-{severity.lower()}"


def check_large_jump(new_depth: float, previous_depth: Optional[float]) -> bool:
    """Returns True if the change exceeds 3 m versus the previous reading."""
    if previous_depth is None:
        return False
    return abs(new_depth - previous_depth) > 3.0
