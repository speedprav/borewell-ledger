"""
ai_analyze.py - POST /ai/analyze endpoint.
"""
from common.ddb import wells_table, get_readings_for_well, get_all_wells
from common.analysis import compute_peer_stats
from common.ai import ai_analyze
from common.ratelimit import check_and_increment_ai_limit
from handlers.utils import ok, bad_request, not_found, server_error, parse_body, get_client_ip
from decimal import Decimal


def _float(v):
    if isinstance(v, Decimal):
        return float(v)
    return v


def handler(event, context):
    body, err = parse_body(event)
    if err:
        return err

    well_id = body.get("wellId")
    if not well_id:
        return bad_request("MISSING_WELL_ID", "wellId is required")

    language = body.get("language", "en")
    if language not in ("en", "hi", "gu"):
        language = "en"

    # Rate limit check
    client_ip = get_client_ip(event)
    allowed, reason = check_and_increment_ai_limit(client_ip)
    if not allowed:
        # Return template response with friendly message
        resp = well_data_to_template(well_id, reason)
        return ok(resp)

    try:
        well_resp = wells_table().get_item(Key={"wellId": well_id})
        well = well_resp.get("Item")
        if not well:
            return not_found("Well")

        readings = get_readings_for_well(well_id)
        all_wells = get_all_wells()
        peers_summary = compute_peer_stats(well, all_wells)

        # Clean decimals
        clean_well = {k: (_float(v) if isinstance(v, Decimal) else v) for k, v in well.items()}
        clean_readings = [{k: (_float(v) if isinstance(v, Decimal) else v)
                          for k, v in r.items()} for r in readings]

        result = ai_analyze(clean_well, clean_readings, peers_summary, language)
        return ok(result)

    except Exception as e:
        return server_error(str(e)[:100])


def well_data_to_template(well_id: str, rate_limit_reason: str) -> dict:
    from common.templates import template_analyze, DISCLAIMER
    return {
        "summary": "AI unavailable. " + rate_limit_reason,
        "whatIsHappening": "AI analysis is temporarily unavailable.",
        "possibleReasons": [
            "Daily AI limit reached.",
            "Service temporarily unavailable.",
            "Please try again tomorrow."
        ],
        "confidence": {"level": "none", "notes": rate_limit_reason},
        "nextSteps": ["Try again tomorrow.", "View trend chart for manual analysis."],
        "advisorySource": "template",
        "disclaimer": DISCLAIMER
    }
