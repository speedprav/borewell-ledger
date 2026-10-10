"""
admin.py - POST /admin/run-analysis endpoint.
Manual trigger for the analyzer with 60-second cooldown.
"""
from common.ratelimit import check_analyzer_cooldown
from handlers.analyzer import run_analysis
from handlers.utils import ok, server_error


def handler_run_analysis(event, context):
    """POST /admin/run-analysis"""
    can_run, seconds_remaining = check_analyzer_cooldown()

    if not can_run:
        return ok({
            "status": "cooldown",
            "message": f"Analyzer ran recently. Please wait {seconds_remaining} seconds.",
            "secondsRemaining": seconds_remaining
        })

    try:
        stats = run_analysis()
        return ok({
            "status": "completed",
            "message": "Analysis completed successfully.",
            "changes": stats
        })
    except Exception as e:
        return server_error(f"Analysis failed: {str(e)[:100]}")
