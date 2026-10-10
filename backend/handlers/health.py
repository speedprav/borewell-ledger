"""health.py - Health check endpoint."""
from handlers.utils import ok


def handler(event, context):
    return ok({"status": "healthy", "service": "borewell-ledger"})
