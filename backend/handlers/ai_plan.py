"""
ai_plan.py - POST /ai/plan endpoint.
"""
from decimal import Decimal
from common.ddb import wells_table, get_all_wells
from common.ai import ai_plan
from common.ratelimit import check_and_increment_ai_limit
from handlers.utils import ok, bad_request, not_found, server_error, parse_body, get_client_ip
from common.templates import DISCLAIMER


def _float(v):
    if isinstance(v, Decimal):
        return float(v)
    return v


def handler(event, context):
    body, err = parse_body(event)
    if err:
        return err

    well_id = body.get("wellId")
    locality = body.get("locality")
    role = body.get("role", "society")
    language = body.get("language", "en")

    if role not in ("society", "farm", "officer", "ngo"):
        role = "society"
    if language not in ("en", "hi", "gu"):
        language = "en"

    if not well_id and not locality:
        return bad_request("MISSING_TARGET", "Either wellId or locality is required")

    # Rate limit check
    client_ip = get_client_ip(event)
    allowed, reason = check_and_increment_ai_limit(client_ip)
    if not allowed:
        return ok({
            "situation": f"AI unavailable: {reason}",
            "measures": [],
            "advisorySource": "template",
            "disclaimer": DISCLAIMER,
            "rateLimited": True
        })

    try:
        if well_id:
            well_resp = wells_table().get_item(Key={"wellId": well_id})
            target = well_resp.get("Item")
            if not target:
                return not_found("Well")
            target = {k: (_float(v) if isinstance(v, Decimal) else v)
                     for k, v in target.items()}
        else:
            # Use locality average as target
            all_wells = get_all_wells()
            loc_wells = [w for w in all_wells if w.get("locality") == locality]
            if not loc_wells:
                return not_found("Locality")
            slopes = [_float(w.get("slopeMPerMonth")) for w in loc_wells
                      if w.get("slopeMPerMonth") is not None]
            import statistics
            target = {
                "locality": locality,
                "slopeMPerMonth": round(statistics.median(slopes), 3) if slopes else None,
                "status": "WATCH",
                "wellCount": len(loc_wells)
            }

        result = ai_plan(target, role, language)
        return ok(result)

    except Exception as e:
        return server_error(str(e)[:100])
