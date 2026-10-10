"""
Lambda handler helpers - shared response formatting.
"""
import json
from decimal import Decimal


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def response(status_code: int, body: dict, headers: dict = None) -> dict:
    default_headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,X-Forwarded-For"
    }
    if headers:
        default_headers.update(headers)
    return {
        "statusCode": status_code,
        "headers": default_headers,
        "body": json.dumps(body, cls=DecimalEncoder)
    }


def ok(body: dict) -> dict:
    return response(200, body)


def created(body: dict) -> dict:
    return response(201, body)


def bad_request(code: str, message: str) -> dict:
    return response(400, {"error": {"code": code, "message": message}})


def not_found(resource: str = "Resource") -> dict:
    return response(404, {"error": {"code": "NOT_FOUND", "message": f"{resource} not found"}})


def server_error(message: str = "Internal server error") -> dict:
    return response(500, {"error": {"code": "INTERNAL_ERROR", "message": message}})


def parse_body(event: dict) -> tuple[dict, None]:
    """Parse JSON body from API Gateway event."""
    body = event.get("body", "{}")
    if not body:
        return {}, None
    if isinstance(body, dict):
        return body, None
    try:
        return json.loads(body), None
    except (json.JSONDecodeError, TypeError):
        return None, bad_request("INVALID_JSON", "Request body must be valid JSON")


def get_client_ip(event: dict) -> str:
    """Extract client IP from API Gateway event."""
    headers = event.get("headers") or {}
    # Check X-Forwarded-For first
    xff = headers.get("x-forwarded-for") or headers.get("X-Forwarded-For", "")
    if xff:
        return xff.split(",")[0].strip()
    ctx = event.get("requestContext", {})
    return ctx.get("http", {}).get("sourceIp", "unknown")
