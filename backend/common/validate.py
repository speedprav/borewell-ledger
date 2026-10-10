"""
validate.py - Input validation for Borewell Ledger.
All validation rules from spec section 6 input validation.
"""
import re
from datetime import date, timedelta
from typing import Optional

from common.geo import is_inside_india


DEPTH_MIN = 0.0
DEPTH_MAX = 300.0
DATE_MAX_YEARS_AGO = 5
NAME_MAX_LEN = 80
NOTE_MAX_LEN = 200
CONTROL_CHAR_RE = re.compile(r'[\x00-\x1f\x7f]')


def strip_control_chars(s: str) -> str:
    return CONTROL_CHAR_RE.sub('', s)


def validate_depth(depth) -> tuple[float, Optional[str]]:
    try:
        d = float(depth)
    except (TypeError, ValueError):
        return None, "depth must be a number"
    if d < DEPTH_MIN or d > DEPTH_MAX:
        return None, f"depth must be between {DEPTH_MIN} and {DEPTH_MAX} m"
    return round(d, 2), None


def validate_date(date_str: str) -> tuple[Optional[date], Optional[str]]:
    if not date_str:
        return None, "date is required"
    try:
        d = date.fromisoformat(str(date_str)[:10])
    except ValueError:
        return None, "date must be in yyyy-mm-dd format"
    today = date.today()
    if d > today:
        return None, "date cannot be in the future"
    cutoff = today - timedelta(days=DATE_MAX_YEARS_AGO * 365)
    if d < cutoff:
        return None, f"date cannot be older than {DATE_MAX_YEARS_AGO} years"
    return d, None


def validate_coords(lat, lon) -> tuple[Optional[tuple], Optional[str]]:
    try:
        lat = float(lat)
        lon = float(lon)
    except (TypeError, ValueError):
        return None, "lat and lon must be numbers"
    if not is_inside_india(lat, lon):
        return None, "coordinates must be within India's bounding box"
    return (lat, lon), None


def validate_name(name: str, max_len: int = NAME_MAX_LEN) -> tuple[Optional[str], Optional[str]]:
    if not name or not isinstance(name, str):
        return None, "name is required"
    name = strip_control_chars(name.strip())
    if not name:
        return None, "name cannot be empty"
    if len(name) > max_len:
        name = name[:max_len]
    return name, None


def validate_note(note: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    if note is None:
        return None, None
    note = strip_control_chars(str(note).strip())
    if len(note) > NOTE_MAX_LEN:
        note = note[:NOTE_MAX_LEN]
    return note, None


def validate_owner_type(owner_type: str) -> tuple[Optional[str], Optional[str]]:
    valid = {"society", "farm", "other"}
    if owner_type not in valid:
        return None, f"ownerType must be one of: {', '.join(sorted(valid))}"
    return owner_type, None


def error_response(code: str, message: str, status_code: int = 400) -> dict:
    return {
        "statusCode": status_code,
        "body": {"error": {"code": code, "message": message}}
    }
