"""
alerts.py - GET /alerts and PATCH /alerts/{id} endpoints.
"""
from decimal import Decimal
from handlers.utils import ok, bad_request, not_found, server_error, parse_body
from common.ddb import alerts_table, scan_all


def _clean(a: dict) -> dict:
    return {k: (float(v) if isinstance(v, Decimal) else v) for k, v in a.items()}


def handler_list(event, context):
    """GET /alerts?status=&severity="""
    params = event.get("queryStringParameters") or {}
    status_filter = params.get("status")
    severity_filter = params.get("severity")

    try:
        alerts = scan_all(alerts_table())

        if status_filter:
            alerts = [a for a in alerts if a.get("status") == status_filter]
        if severity_filter:
            alerts = [a for a in alerts if a.get("severity") == severity_filter]

        alerts.sort(key=lambda a: a.get("createdAt", ""), reverse=True)

        return ok({
            "alerts": [_clean(a) for a in alerts],
            "total": len(alerts)
        })
    except Exception as e:
        return server_error(str(e)[:100])


def handler_patch(event, context):
    """PATCH /alerts/{id} - update status (seen|resolved)"""
    alert_id = event.get("pathParameters", {}).get("id")
    if not alert_id:
        return bad_request("MISSING_ID", "Alert ID is required")

    body, err = parse_body(event)
    if err:
        return err

    new_status = body.get("status")
    if new_status not in ("seen", "resolved"):
        return bad_request("INVALID_STATUS", "Status must be 'seen' or 'resolved'")

    try:
        from datetime import datetime
        update_kwargs = {
            "Key": {"alertId": alert_id},
            "UpdateExpression": "SET #st = :st, updatedAt = :ua",
            "ExpressionAttributeNames": {"#st": "status"},
            "ExpressionAttributeValues": {
                ":st": new_status,
                ":ua": datetime.utcnow().isoformat()
            },
            "ReturnValues": "ALL_NEW"
        }
        if new_status == "resolved":
            update_kwargs["UpdateExpression"] += ", resolvedAt = :ra"
            update_kwargs["ExpressionAttributeValues"][":ra"] = datetime.utcnow().isoformat()

        resp = alerts_table().update_item(**update_kwargs)
        updated = resp.get("Attributes", {})
        if not updated:
            return not_found("Alert")

        return ok({"alert": _clean(updated)})
    except Exception as e:
        return server_error(str(e)[:100])
