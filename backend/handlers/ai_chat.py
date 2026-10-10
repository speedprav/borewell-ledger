"""
ai_chat.py - POST /ai/chat endpoint.
"""
from decimal import Decimal
from common.ddb import wells_table, get_readings_for_well
from common.ai import ai_chat
from common.ratelimit import check_and_increment_ai_limit
from handlers.utils import ok, bad_request, server_error, parse_body, get_client_ip
from common.templates import template_chat, DISCLAIMER


def _float(v):
    if isinstance(v, Decimal):
        return float(v)
    return v


def handler(event, context):
    body, err = parse_body(event)
    if err:
        return err

    messages = body.get("messages", [])
    if not messages or not isinstance(messages, list):
        return bad_request("MISSING_MESSAGES", "messages array is required")

    well_id = body.get("wellId")
    language = body.get("language", "en")
    if language not in ("en", "hi", "gu"):
        language = "en"

    # Validate messages format
    for msg in messages:
        if not isinstance(msg, dict) or "content" not in msg:
            return bad_request("INVALID_MESSAGE", "Each message must have 'content' field")

    # Rate limit check
    client_ip = get_client_ip(event)
    allowed, reason = check_and_increment_ai_limit(client_ip)
    if not allowed:
        last_msg = messages[-1].get("content", "") if messages else ""
        fallback = template_chat(last_msg, None)
        return ok({
            "reply": f"*{reason}*\n\n{fallback}",
            "sources": {"readingsUsed": 0, "peersUsed": 0, "alertIdsReferenced": []},
            "advisorySource": "template",
            "rateLimited": True
        })

    # Load well data if provided
    well_data = None
    if well_id:
        try:
            well_resp = wells_table().get_item(Key={"wellId": well_id})
            well = well_resp.get("Item")
            if well:
                readings = get_readings_for_well(well_id)
                well_data = {k: (_float(v) if isinstance(v, Decimal) else v)
                            for k, v in well.items()}
                recent = sorted(readings, key=lambda r: r.get("date", ""), reverse=True)[:12]
                well_data["recentReadings"] = [
                    {k: (_float(v) if isinstance(v, Decimal) else v)
                     for k, v in r.items()} for r in recent
                ]
                well_data["peerCount"] = well_data.get("peerCount", 0)
        except Exception:
            pass

    try:
        reply, sources = ai_chat(messages, well_data, language)
        return ok({
            "reply": reply,
            "sources": sources,
            "advisorySource": "ai" if well_data else "template"
        })
    except Exception as e:
        last_msg = messages[-1].get("content", "") if messages else ""
        fallback = template_chat(last_msg, well_data)
        return ok({
            "reply": fallback,
            "sources": {"readingsUsed": 0, "peersUsed": 0, "alertIdsReferenced": []},
            "advisorySource": "template",
            "error": str(e)[:100]
        })
