"""
community.py - GET /community endpoint.
Returns locality-level insights: status distribution, hotspots, median depth over time.
"""
from decimal import Decimal
from collections import defaultdict
import statistics

from common.ddb import get_all_wells, scan_all, readings_table
from handlers.utils import ok, server_error


def _float(v):
    if isinstance(v, Decimal):
        return float(v)
    return v


def handler(event, context):
    """GET /community?locality="""
    params = event.get("queryStringParameters") or {}
    locality_filter = params.get("locality")

    try:
        all_wells = get_all_wells()

        # Group by locality
        by_locality = defaultdict(list)
        for w in all_wells:
            loc = w.get("locality", "Unknown")
            by_locality[loc].append(w)

        # Status distribution across all wells
        status_dist = defaultdict(int)
        for w in all_wells:
            status_dist[w.get("status", "NOT_ENOUGH_DATA")] += 1

        # Hotspot ranking: localities by median slope (descending)
        hotspots = []
        coverage_gaps = []
        for loc, wells in by_locality.items():
            slopes = [_float(w.get("slopeMPerMonth")) for w in wells
                      if w.get("slopeMPerMonth") is not None]
            statuses = defaultdict(int)
            for w in wells:
                statuses[w.get("status", "NOT_ENOUGH_DATA")] += 1

            if len(wells) < 3:
                coverage_gaps.append({
                    "locality": loc,
                    "wellCount": len(wells),
                    "message": f"Only {len(wells)} well(s) in {loc}. Add more for better coverage.",
                    "inviteMessage": (
                        f"We need more borewell readings in {loc}! "
                        f"Log your well at Borewell Ledger to help your community."
                    )
                })

            hotspots.append({
                "locality": loc,
                "wellCount": len(wells),
                "medianSlope": round(statistics.median(slopes), 3) if slopes else None,
                "criticalCount": statuses.get("CRITICAL", 0),
                "watchCount": statuses.get("WATCH", 0),
                "normalCount": statuses.get("NORMAL", 0),
                "noDataCount": statuses.get("NOT_ENOUGH_DATA", 0)
            })

        hotspots.sort(key=lambda h: (h["medianSlope"] or -999), reverse=True)

        # If locality filter, return depth over time for that locality
        depth_over_time = []
        if locality_filter:
            loc_wells = by_locality.get(locality_filter, [])
            # Aggregate readings by month
            monthly = defaultdict(list)
            for w in loc_wells:
                well_id = w.get("wellId")
                # We need to scan readings — do it efficiently
                from boto3.dynamodb.conditions import Key
                from common.ddb import query_all, readings_table as rt
                try:
                    readings = query_all(rt(), Key("wellId").eq(well_id))
                    for r in readings:
                        month = str(r.get("date", ""))[:7]  # yyyy-mm
                        if month:
                            monthly[month].append(_float(r.get("depthM", 0)))
                except Exception:
                    continue

            for month, depths in sorted(monthly.items()):
                depth_over_time.append({
                    "month": month,
                    "median": round(statistics.median(depths), 2),
                    "min": round(min(depths), 2),
                    "max": round(max(depths), 2),
                    "sampleCount": len(depths)
                })

        return ok({
            "statusDistribution": dict(status_dist),
            "totalWells": len(all_wells),
            "hotspots": hotspots,
            "coverageGaps": coverage_gaps,
            "depthOverTime": depth_over_time,
            "locality": locality_filter
        })
    except Exception as e:
        return server_error(str(e)[:100])
