"""
readings.py - POST /readings endpoint.
Adds a reading to a well and recomputes analysis.
"""
from datetime import datetime
from decimal import Decimal

from common.ddb import readings_table, get_all_wells, get_readings_for_well
from common.validate import validate_depth, validate_date, validate_note
from common.analysis import check_large_jump
from handlers.utils import ok, bad_request, not_found, server_error, parse_body
from handlers.wells import _recompute_well


def handler(event, context):
    """POST /readings"""
    body, err = parse_body(event)
    if err:
        return err

    well_id = body.get("wellId")
    if not well_id:
        return bad_request("MISSING_WELL_ID", "wellId is required")

    depth, err = validate_depth(body.get("depthM"))
    if err:
        return bad_request("INVALID_DEPTH", err)

    reading_date, err = validate_date(body.get("date"))
    if err:
        return bad_request("INVALID_DATE", err)

    note, _ = validate_note(body.get("note"))

    # Verify well exists
    from common.ddb import wells_table
    resp = wells_table().get_item(Key={"wellId": well_id})
    if not resp.get("Item"):
        return not_found("Well")

    # Check for large jump vs previous reading
    existing_readings = get_readings_for_well(well_id)
    prev_depth = None
    if existing_readings:
        sorted_readings = sorted(existing_readings, key=lambda r: r.get("date", ""))
        # Get the reading just before this date
        before = [r for r in sorted_readings
                  if r.get("date", "") < reading_date.isoformat()]
        if before:
            prev_depth = float(before[-1].get("depthM", 0))

    large_jump = check_large_jump(depth, prev_depth)

    # Write reading (upsert - overwrites same date)
    now = datetime.utcnow().isoformat()
    item = {
        "wellId": well_id,
        "date": reading_date.isoformat(),
        "depthM": Decimal(str(depth)),
        "source": body.get("source", "user"),
        "createdAt": now
    }
    if note:
        item["note"] = note

    readings_table().put_item(Item=item)

    # Recompute immediately
    try:
        all_wells = get_all_wells()
        updated = _recompute_well(well_id, all_wells)
    except Exception:
        updated = {}

    result = {
        "reading": {
            "wellId": well_id,
            "date": reading_date.isoformat(),
            "depthM": depth,
            "source": item.get("source", "user")
        },
        "updatedWell": updated
    }
    if large_jump:
        result["warning"] = "large_jump"
        result["warningMessage"] = (
            f"Depth changed by more than 3 m from previous reading "
            f"({prev_depth:.1f} m → {depth:.1f} m). Please verify."
        )

    return ok(result)
