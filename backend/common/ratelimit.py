"""
ratelimit.py - AI rate limiting helpers for Borewell Ledger.
Stores daily caps in Meta table with TTL.
"""
import os
import time
import hashlib
from datetime import date, datetime, timezone
from typing import Optional

from common.ddb import meta_table

# Daily caps — raised for demo use
AI_DAILY_TOTAL_CAP = 500
AI_DAILY_IP_CAP = 200


def _hash_ip(ip: str) -> str:
    """Hash IP with per-deployment salt before storing."""
    salt = os.environ.get("IP_SALT", "borewell-ledger-default-salt")
    return hashlib.sha256(f"{salt}:{ip}".encode()).hexdigest()[:16]


def _today_str() -> str:
    return date.today().isoformat()


def _midnight_ttl() -> int:
    """Unix timestamp for end of today UTC."""
    now = datetime.now(timezone.utc)
    tomorrow = now.replace(hour=0, minute=0, second=0, microsecond=0)
    # Add 24h
    return int(tomorrow.timestamp()) + 86400


def check_and_increment_ai_limit(client_ip: Optional[str]) -> tuple[bool, str]:
    """
    Returns (allowed: bool, reason: str).
    Increments counters if allowed.
    """
    table = meta_table()
    today = _today_str()
    ttl = _midnight_ttl()

    # Check total daily cap
    total_key = f"ai:total:{today}"
    try:
        resp = table.update_item(
            Key={"key": total_key},
            UpdateExpression="SET #c = if_not_exists(#c, :zero) + :one, #ttl = :ttl",
            ExpressionAttributeNames={"#c": "count", "#ttl": "ttl"},
            ExpressionAttributeValues={":zero": 0, ":one": 1, ":ttl": ttl},
            ReturnValues="UPDATED_NEW"
        )
        total_count = int(resp["Attributes"]["count"])
        if total_count > AI_DAILY_TOTAL_CAP:
            # Decrement back
            table.update_item(
                Key={"key": total_key},
                UpdateExpression="SET #c = #c - :one",
                ExpressionAttributeNames={"#c": "count"},
                ExpressionAttributeValues={":one": 1}
            )
            return False, "Daily AI limit reached. Try again tomorrow."
    except Exception:
        return True, ""  # Fail open to avoid blocking users

    # Check per-IP cap
    if client_ip:
        hashed = _hash_ip(client_ip)
        ip_key = f"ai:ip:{today}:{hashed}"
        try:
            resp = table.update_item(
                Key={"key": ip_key},
                UpdateExpression="SET #c = if_not_exists(#c, :zero) + :one, #ttl = :ttl",
                ExpressionAttributeNames={"#c": "count", "#ttl": "ttl"},
                ExpressionAttributeValues={":zero": 0, ":one": 1, ":ttl": ttl},
                ReturnValues="UPDATED_NEW"
            )
            ip_count = int(resp["Attributes"]["count"])
            if ip_count > AI_DAILY_IP_CAP:
                table.update_item(
                    Key={"key": ip_key},
                    UpdateExpression="SET #c = #c - :one",
                    ExpressionAttributeNames={"#c": "count"},
                    ExpressionAttributeValues={":one": 1}
                )
                return False, "You have reached your daily AI limit. Try again tomorrow."
        except Exception:
            pass  # Fail open

    return True, ""


def check_analyzer_cooldown() -> tuple[bool, int]:
    """
    Returns (can_run: bool, seconds_remaining: int).
    60-second cooldown for manual analysis runs.
    """
    table = meta_table()
    now = int(time.time())
    cooldown_key = "analyzer:cooldown"

    try:
        resp = table.get_item(Key={"key": cooldown_key})
        item = resp.get("Item")
        if item:
            last_run = int(item.get("lastRun", 0))
            elapsed = now - last_run
            if elapsed < 60:
                return False, 60 - elapsed
    except Exception:
        pass

    # Set the cooldown
    try:
        table.put_item(Item={
            "key": cooldown_key,
            "lastRun": now,
            "ttl": now + 120
        })
    except Exception:
        pass

    return True, 0
