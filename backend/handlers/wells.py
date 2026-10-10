"""
wells.py - GET /wells/{id} and POST /wells endpoints.
"""
import uuid
import json
from datetime import datetime, date
from decimal import Decimal

from common.ddb import (wells_table, readings_table, get_all_wells,
                        get_readings_for_well)
from common.validate import (validate_depth, validate_date, validate_coords,
                              validate_name, validate_note, validate_owner_type)
from common.geo import encode_geohash, round_coords
from common.analysis import (compute_slope_mpm, compute_peer_stats,
                              classify_status, compute_dryout_estimate,
                              check_large_jump)
from handlers.utils import (ok, created, bad_request, not_found,
                             server_error, parse_body, get_client_ip)


def _float(v):
    if isinstance(v, Decimal):
        return float(v)
    return v


def _clean_well(w: dict) -> dict:
    return {k: (_float(v) if isinstance(v, Decimal) else v) for k, v in w.items()}


def _clean_reading(r: dict) -> dict:
    return {k: (_float(v) if isinstance(v, Decimal) else v) for k, v in r.items()}


def _recompute_well(well_id: str, all_wells: list[dict] = None) -> dict:
    """Recompute slope, status, peer stats for a well and persist."""
    readings = get_readings_for_well(well_id)
    if all_wells is None:
        all_wells = get_all_wells()

    slope = compute_slope_mpm(readings)

    # Get this well from list
    this_well = next((w for w in all_wells if w["wellId"] == well_id), None)
    if this_well is None:
        return {}

    peer_info = compute_peer_stats(this_well, all_wells)
    peer_median = peer_info.get("peerMedian")
    status = classify_status(slope, peer_median)

    # Find latest reading
    if readings:
        latest = max(readings, key=lambda r: r.get("date", ""))
        latest_depth = float(latest.get("depthM", 0))
        latest_date = latest.get("date")
    else:
        latest_depth = this_well.get("latestDepthM")
        latest_date = this_well.get("latestDate")

    table = wells_table()
    now_str = datetime.utcnow().isoformat()

    # Build SET and REMOVE expressions separately to handle None values
    set_parts = ["#status = :status", "peerCount = :pc", "updatedAt = :ua"]
    expr_values: dict = {
        ":status": status,
        ":pc": peer_info.get("peerCount", 0),
        ":ua": now_str
    }
    remove_parts = []

    if slope is not None:
        set_parts.append("slopeMPerMonth = :slope")
        expr_values[":slope"] = Decimal(str(slope))
    else:
        remove_parts.append("slopeMPerMonth")

    if peer_median is not None:
        set_parts.append("peerMedian = :pm")
        expr_values[":pm"] = Decimal(str(peer_median))
    else:
        remove_parts.append("peerMedian")

    if latest_depth is not None:
        set_parts.append("latestDepthM = :ld")
        expr_values[":ld"] = Decimal(str(latest_depth))

    if latest_date is not None:
        set_parts.append("latestDate = :ldate")
        expr_values[":ldate"] = latest_date

    update_expr = "SET " + ", ".join(set_parts)
    if remove_parts:
        update_expr += " REMOVE " + ", ".join(remove_parts)

    table.update_item(
        Key={"wellId": well_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues=expr_values
    )

    return {
        "wellId": well_id,
        "slopeMPerMonth": slope,
        "status": status,
        "peerMedian": peer_median,
        "peerCount": peer_info.get("peerCount", 0),
        "latestDepthM": latest_depth,
        "latestDate": latest_date
    }


def handler_get(event, context):
    """GET /wells/{id}"""
    well_id = event.get("pathParameters", {}).get("id")
    if not well_id:
        return bad_request("MISSING_ID", "Well ID is required")

    try:
        resp = wells_table().get_item(Key={"wellId": well_id})
        well = resp.get("Item")
        if not well:
            return not_found("Well")

        readings = get_readings_for_well(well_id)
        all_wells = get_all_wells()
        peer_info = compute_peer_stats(well, all_wells)

        # Build anonymized peers list
        peers_out = []
        for i, p in enumerate(peer_info.get("peers", [])[:10]):
            peers_out.append({
                "label": f"Neighbor {i + 1}",
                "distKm": p["distKm"],
                "slope": p["slope"]
            })

        # Dry-out estimate
        pump_depth = _float(well.get("pumpDepthM"))
        latest_depth = _float(well.get("latestDepthM"))
        slope = _float(well.get("slopeMPerMonth"))
        dryout = compute_dryout_estimate(pump_depth, latest_depth, slope)

        # Data quality flags
        flags = []
        if len(readings) < 3:
            flags.append("few_readings")
        if readings:
            latest_date_str = max(r.get("date", "") for r in readings)
            try:
                latest_date = date.fromisoformat(latest_date_str)
                if (date.today() - latest_date).days > 30:
                    flags.append("stale_reading")
            except ValueError:
                pass

        return ok({
            "well": _clean_well(well),
            "readings": sorted([_clean_reading(r) for r in readings],
                               key=lambda r: r.get("date", "")),
            "peers": {
                "summary": peers_out,
                "peerCount": peer_info.get("peerCount", 0),
                "peerMedian": peer_info.get("peerMedian")
            },
            "dryoutEstimate": dryout,
            "dataQualityFlags": flags
        })
    except Exception as e:
        return server_error(str(e)[:100])


def handler_create(event, context):
    """POST /wells - create a new well (optionally with first reading)"""
    body, err = parse_body(event)
    if err:
        return err

    # Validate required fields
    name, err = validate_name(body.get("name", ""))
    if err:
        return bad_request("INVALID_NAME", err)

    owner_type, err = validate_owner_type(body.get("ownerType", "other"))
    if err:
        return bad_request("INVALID_OWNER_TYPE", err)

    locality, err = validate_name(body.get("locality", ""), max_len=80)
    if err:
        return bad_request("INVALID_LOCALITY", err)

    coords, err = validate_coords(body.get("lat"), body.get("lon"))
    if err:
        return bad_request("INVALID_COORDS", err)
    lat, lon = round_coords(coords[0], coords[1])

    # Optional fields
    pump_depth = None
    if body.get("pumpDepthM") is not None:
        pump_depth, err = validate_depth(body["pumpDepthM"])
        if err:
            return bad_request("INVALID_PUMP_DEPTH", err)

    note, _ = validate_note(body.get("note"))

    # Optional first reading
    first_reading = None
    warning = None
    if body.get("depthM") is not None and body.get("date"):
        depth, err = validate_depth(body["depthM"])
        if err:
            return bad_request("INVALID_DEPTH", err)
        reading_date, err = validate_date(body["date"])
        if err:
            return bad_request("INVALID_DATE", err)
        first_reading = {
            "depthM": depth,
            "date": reading_date.isoformat()
        }

    well_id = str(uuid.uuid4())
    geohash = encode_geohash(lat, lon, precision=5)
    now = datetime.utcnow().isoformat()

    well_item = {
        "wellId": well_id,
        "name": name,
        "ownerType": owner_type,
        "locality": locality,
        "lat": Decimal(str(lat)),
        "lon": Decimal(str(lon)),
        "geohash5": geohash,
        "source": body.get("source", "user"),
        "createdAt": now,
        "status": "NOT_ENOUGH_DATA",
        "latestDepthM": None,
        "latestDate": None,
        "slopeMPerMonth": None,
        "peerMedian": None,
        "peerCount": 0
    }
    if pump_depth is not None:
        well_item["pumpDepthM"] = Decimal(str(pump_depth))
    if note:
        well_item["note"] = note

    wells_table().put_item(Item=well_item)

    # Write first reading if provided
    if first_reading:
        reading_item = {
            "wellId": well_id,
            "date": first_reading["date"],
            "depthM": Decimal(str(first_reading["depthM"])),
            "source": body.get("source", "user"),
            "createdAt": now
        }
        if note:
            reading_item["note"] = note
        readings_table().put_item(Item=reading_item)

        # Recompute
        updated = _recompute_well(well_id)
        well_item.update(updated)

    clean = _clean_well(well_item)
    if warning:
        clean["warning"] = warning

    return created({"well": clean})
