"""
analyzer.py - Core analysis Lambda.
Runs nightly via EventBridge schedule or on-demand via /admin/run-analysis.
Computes slopes, statuses, peers, creates/resolves alerts, publishes SNS.
"""
import os
import uuid
import json
from datetime import datetime, timezone
from decimal import Decimal
import boto3

from common.ddb import (get_all_wells, get_readings_for_well, wells_table,
                        alerts_table, scan_all)
from common.analysis import (compute_slope_mpm, compute_peer_stats,
                              classify_status, detect_area_alerts,
                              make_alert_id, AREA_ALERT_MIN_WELLS)
from handlers.utils import ok, server_error


SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")
_sns = None


def _get_sns():
    global _sns
    if _sns is None:
        _sns = boto3.client("sns")
    return _sns


def _float(v):
    if isinstance(v, Decimal):
        return float(v)
    return v


def _publish_sns(subject: str, message: str) -> None:
    if not SNS_TOPIC_ARN:
        return
    try:
        _get_sns().publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=subject[:100],
            Message=message[:1000]
        )
    except Exception:
        pass


def run_analysis() -> dict:
    """
    Main analysis loop. Returns summary of changes.
    """
    all_wells = get_all_wells()
    if not all_wells:
        return {"wellsAnalyzed": 0, "alertsCreated": 0, "alertsResolved": 0,
                "statusChanges": 0}

    # Fetch all existing open alerts
    existing_alerts = scan_all(alerts_table())
    open_alerts_by_ref = {}
    for a in existing_alerts:
        if a.get("status") != "resolved":
            ref = a.get("wellId") or a.get("locality", "")
            sev = a.get("severity", "")
            key = f"{a.get('type','WELL')}:{ref}:{sev}"
            open_alerts_by_ref[key] = a

    stats = {
        "wellsAnalyzed": 0,
        "alertsCreated": 0,
        "alertsResolved": 0,
        "statusChanges": 0,
        "criticalWells": [],
        "watchWells": []
    }

    updated_wells = []

    for well in all_wells:
        well_id = well["wellId"]
        readings = get_readings_for_well(well_id)
        slope = compute_slope_mpm(readings)

        # Temporarily set slope for peer computation
        well["slopeMPerMonth"] = slope
        updated_wells.append(well)

    # Now compute peers with updated slopes
    for well in updated_wells:
        well_id = well["wellId"]
        slope = well.get("slopeMPerMonth")
        peer_info = compute_peer_stats(well, updated_wells)
        peer_median = peer_info.get("peerMedian")
        old_status = well.get("status", "NOT_ENOUGH_DATA")
        new_status = classify_status(slope, peer_median)

        # Find latest reading
        readings = get_readings_for_well(well_id)
        latest_depth = None
        latest_date = None
        if readings:
            latest = max(readings, key=lambda r: r.get("date", ""))
            latest_depth = _float(latest.get("depthM"))
            latest_date = latest.get("date")

        # Persist updated well
        now = datetime.now(timezone.utc).isoformat()

        # Build SET and REMOVE clauses separately so None values are properly handled
        set_parts = ["#status = :status", "peerCount = :pc", "updatedAt = :ua"]
        expr_values = {
            ":status": new_status,
            ":pc": peer_info.get("peerCount", 0),
            ":ua": now
        }
        remove_parts = []

        if slope is not None:
            set_parts.append("slopeMPerMonth = :slope")
            expr_values[":slope"] = Decimal(str(round(slope, 4)))
        else:
            remove_parts.append("slopeMPerMonth")

        if peer_median is not None:
            set_parts.append("peerMedian = :pm")
            expr_values[":pm"] = Decimal(str(round(peer_median, 4)))
        else:
            remove_parts.append("peerMedian")

        if latest_depth is not None:
            set_parts.append("latestDepthM = :ld")
            set_parts.append("latestDate = :ldate")
            expr_values[":ld"] = Decimal(str(latest_depth))
            expr_values[":ldate"] = latest_date

        update_expr = "SET " + ", ".join(set_parts)
        if remove_parts:
            update_expr += " REMOVE " + ", ".join(remove_parts)

        update_kwargs = {
            "Key": {"wellId": well_id},
            "UpdateExpression": update_expr,
            "ExpressionAttributeNames": {"#status": "status"},
            "ExpressionAttributeValues": expr_values
        }

        try:
            wells_table().update_item(**update_kwargs)
        except Exception:
            pass

        if old_status != new_status:
            stats["statusChanges"] += 1
        stats["wellsAnalyzed"] += 1

        # Handle well-level alerts
        if new_status in ("CRITICAL", "WATCH"):
            alert_key = f"WELL:{well_id}:{new_status}"
            if alert_key not in open_alerts_by_ref:
                # Check if escalation from WATCH to CRITICAL
                watch_key = f"WELL:{well_id}:WATCH"
                if new_status == "CRITICAL" and watch_key in open_alerts_by_ref:
                    # Resolve watch alert before creating critical
                    old_alert = open_alerts_by_ref[watch_key]
                    try:
                        alerts_table().update_item(
                            Key={"alertId": old_alert["alertId"]},
                            UpdateExpression="SET #st = :st, resolvedAt = :ra",
                            ExpressionAttributeNames={"#st": "status"},
                            ExpressionAttributeValues={
                                ":st": "resolved",
                                ":ra": now
                            }
                        )
                        stats["alertsResolved"] += 1
                    except Exception:
                        pass

                alert_id = make_alert_id("WELL", well_id, new_status)
                message = (
                    f"Well '{well.get('name', well_id)}' in {well.get('locality', 'unknown')} "
                    f"is {new_status}. Rate: {slope:.2f} m/month"
                    if slope else f"Well status: {new_status}"
                )
                try:
                    alerts_table().put_item(Item={
                        "alertId": alert_id,
                        "type": "WELL",
                        "severity": new_status,
                        "wellId": well_id,
                        "locality": well.get("locality", ""),
                        "ownSlope": Decimal(str(slope)) if slope else None,
                        "peerMedian": Decimal(str(peer_median)) if peer_median else None,
                        "message": message,
                        "advisoryText": "",
                        "advisorySource": "system",
                        "status": "new",
                        "createdAt": now
                    })
                    open_alerts_by_ref[alert_key] = {"alertId": alert_id}
                    stats["alertsCreated"] += 1

                    # SNS only for new CRITICAL
                    if new_status == "CRITICAL":
                        _publish_sns(
                            f"🚨 CRITICAL Borewell Alert: {well.get('name', well_id)}",
                            message
                        )
                        stats["criticalWells"].append(well.get("name", well_id))
                    else:
                        stats["watchWells"].append(well.get("name", well_id))
                except Exception:
                    pass

        elif new_status == "NORMAL":
            # Resolve any open alerts for this well
            for sev in ("CRITICAL", "WATCH"):
                alert_key = f"WELL:{well_id}:{sev}"
                if alert_key in open_alerts_by_ref:
                    old_alert = open_alerts_by_ref[alert_key]
                    try:
                        alerts_table().update_item(
                            Key={"alertId": old_alert["alertId"]},
                            UpdateExpression="SET #st = :st, resolvedAt = :ra",
                            ExpressionAttributeNames={"#st": "status"},
                            ExpressionAttributeValues={
                                ":st": "resolved",
                                ":ra": now
                            }
                        )
                        stats["alertsResolved"] += 1
                    except Exception:
                        pass

    # Area alerts
    area_alerts = detect_area_alerts(updated_wells)
    for area in area_alerts:
        locality = area["locality"]
        alert_key = f"AREA:{locality}:CRITICAL"
        if alert_key not in open_alerts_by_ref:
            alert_id = make_alert_id("AREA", locality.replace(" ", "_"), "CRITICAL")
            message = (
                f"Area-wide alert for {locality}: "
                f"{area['wellCount']} wells declining at median "
                f"{area['medianSlope']:.2f} m/month"
            )
            try:
                alerts_table().put_item(Item={
                    "alertId": alert_id,
                    "type": "AREA",
                    "severity": "CRITICAL",
                    "locality": locality,
                    "wellCount": area["wellCount"],
                    "medianSlope": Decimal(str(area["medianSlope"])),
                    "centroidLat": Decimal(str(area["centroidLat"])),
                    "centroidLon": Decimal(str(area["centroidLon"])),
                    "message": message,
                    "advisoryText": "",
                    "advisorySource": "system",
                    "status": "new",
                    "createdAt": now
                })
                stats["alertsCreated"] += 1
                _publish_sns(
                    f"🚨 Area-wide Groundwater Alert: {locality}",
                    message
                )
            except Exception:
                pass

    return stats


def handler(event, context):
    """EventBridge schedule handler."""
    try:
        stats = run_analysis()
        print(f"Analysis complete: {json.dumps(stats)}")
        return {"statusCode": 200, "body": json.dumps(stats)}
    except Exception as e:
        print(f"Analysis failed: {e}")
        return {"statusCode": 500, "body": str(e)}
