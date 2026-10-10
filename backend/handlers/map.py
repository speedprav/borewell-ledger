"""
map.py - GET /map endpoint.
Returns all wells with latest values, status, and area alerts.
"""
import json
from decimal import Decimal
from collections import defaultdict
import statistics

from common.ddb import get_all_wells, scan_all, alerts_table
from handlers.utils import ok, server_error


def handler(event, context):
    try:
        wells = get_all_wells()

        # Build area alert summary from Alerts table
        area_alerts_raw = scan_all(
            alerts_table(),
        )
        area_alerts = []
        for a in area_alerts_raw:
            if a.get("type") == "AREA" and a.get("status") != "resolved":
                area_alerts.append({
                    "alertId": a.get("alertId"),
                    "locality": a.get("locality"),
                    "wellCount": a.get("wellCount", 0),
                    "medianSlope": float(a.get("medianSlope", 0)),
                    "centroidLat": float(a.get("centroidLat", 0)),
                    "centroidLon": float(a.get("centroidLon", 0)),
                    "severity": a.get("severity", "WATCH"),
                    "message": a.get("message", "")
                })

        # Serialize wells - convert Decimals
        clean_wells = []
        for w in wells:
            cw = {}
            for k, v in w.items():
                if isinstance(v, Decimal):
                    cw[k] = float(v)
                else:
                    cw[k] = v
            clean_wells.append(cw)

        return ok({
            "wells": clean_wells,
            "areaAlerts": area_alerts,
            "total": len(clean_wells)
        })
    except Exception as e:
        return server_error(f"Failed to load map data: {str(e)[:100]}")
