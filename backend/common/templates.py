"""
templates.py - Deterministic template fallbacks for AI features.
Used when Bedrock is unavailable or rate-limited.
Clearly marked as template advice.
"""
from typing import Optional


DISCLAIMER = (
    "⚠️ Template advice — AI unavailable. "
    "These suggestions are based on fixed rules, not AI analysis."
)


def template_analyze(well: dict, readings: list[dict], peers_summary: dict) -> dict:
    """Rule-based analysis fallback for /ai/analyze."""
    slope = well.get("slopeMPerMonth")
    status = well.get("status", "NOT_ENOUGH_DATA")
    latest_depth = well.get("latestDepthM")
    peer_median = well.get("peerMedian")
    well_name = well.get("name", "this borewell")
    peer_count = peers_summary.get("peerCount", 0)

    if status == "NOT_ENOUGH_DATA" or slope is None:
        return {
            "summary": f"Insufficient data for {well_name}.",
            "whatIsHappening": (
                "Not enough readings to determine a trend. "
                "At least 3 readings over 14 days within the last 90 days are needed."
            ),
            "possibleReasons": [
                "Fewer than 3 readings in the last 90 days.",
                "Readings do not span at least 14 days.",
                "All readings may be outside the 90-day analysis window."
            ],
            "confidence": {
                "level": "none",
                "notes": "Insufficient data."
            },
            "nextSteps": [
                "Add more readings with at least 2 weeks between the first and last.",
                "Ensure readings are dated within the last 90 days.",
                "Continue logging weekly for reliable trend analysis."
            ],
            "advisorySource": "template",
            "disclaimer": DISCLAIMER
        }

    direction = "declining (water table falling)" if slope > 0 else "stable or recovering"
    rate_desc = f"{abs(slope):.2f} m/month"

    if status == "CRITICAL":
        summary = f"CRITICAL: {well_name} is declining rapidly at {rate_desc}."
        what = (
            f"The water level in {well_name} is falling at {rate_desc}, "
            f"which is significantly faster than nearby wells "
            f"(peer median: {peer_median:.2f} m/month)." if peer_median else
            f"The water level is falling rapidly at {rate_desc}."
        )
        reasons = [
            "Very high extraction rates relative to recharge.",
            "Seasonal aquifer stress combined with delayed monsoon recharge.",
            "Possible shared aquifer depletion from cluster pumping."
        ]
        next_steps = [
            "Reduce pumping hours immediately, especially mid-day.",
            "Check for leaks in pipes and storage tanks.",
            "Consider rainwater harvesting to supplement supply.",
            "Consult a local hydrogeologist or water authority.",
            "Monitor daily and log readings to track response to any changes."
        ]
    elif status == "WATCH":
        summary = f"WATCH: {well_name} is {direction} at {rate_desc}."
        what = (
            f"The water level is {direction} at {rate_desc}. "
            "This is above the normal threshold and warrants attention."
        )
        reasons = [
            "Seasonal demand may exceed recharge rate.",
            "Extraction levels may need to be reduced.",
            "Local land-use changes may be affecting recharge."
        ]
        next_steps = [
            "Monitor weekly and log readings consistently.",
            "Reduce non-essential water use during peak demand.",
            "Identify and fix any leaks or overflows.",
            "Consider a recharge pit or percolation well nearby.",
            "Connect with neighbors to understand area-wide trends."
        ]
    else:
        summary = f"NORMAL: {well_name} appears stable."
        what = (
            f"The water level trend is {direction} at {rate_desc}. "
            "This is within expected seasonal variation."
        )
        reasons = [
            "Extraction and recharge appear balanced.",
            "Recent rainfall may have contributed to recovery.",
            "Pumping schedule may be well-managed."
        ]
        next_steps = [
            "Continue regular monthly readings.",
            "Maintain good practices such as pump-off timing.",
            "Keep an eye on readings during dry season (March–June).",
        ]

    return {
        "summary": summary,
        "whatIsHappening": what,
        "possibleReasons": reasons,
        "confidence": {
            "level": "low" if peer_count < 3 else "medium",
            "notes": (
                "Template advice based on fixed rules. "
                f"Based on {len(readings)} reading(s) and "
                f"{peer_count} nearby well(s)."
            )
        },
        "nextSteps": next_steps,
        "advisorySource": "template",
        "disclaimer": DISCLAIMER
    }


def template_plan(well_or_locality: dict, role: str, language: str = "en") -> dict:
    """Rule-based water-saving plan fallback for /ai/plan."""
    is_society = role == "society"
    is_farm = role == "farm"
    is_official = role in ("officer", "ngo")

    if is_society:
        measures = [
            {
                "id": "fix-leaks", "tier": "this_week",
                "title": "Fix leaks and overflows",
                "whyItHelps": "Leaks can waste 20–30% of stored water.",
                "effort": "low", "benefit": "high",
                "costRange": "₹0–2,000"
            },
            {
                "id": "pump-timing", "tier": "this_week",
                "title": "Pump only after 30 min pump-off",
                "whyItHelps": "Reduces over-extraction and improves measurement accuracy.",
                "effort": "low", "benefit": "medium",
                "costRange": "₹0"
            },
            {
                "id": "sub-metering", "tier": "this_week",
                "title": "Install sub-meters per flat",
                "whyItHelps": "Awareness reduces usage 15–25%.",
                "effort": "medium", "benefit": "high",
                "costRange": "₹500–1,500 per meter"
            },
            {
                "id": "rwh", "tier": "this_month",
                "title": "Rooftop rainwater harvesting",
                "whyItHelps": "Supplements supply; 100 m² roof yields ~50,000 L/year.",
                "effort": "medium", "benefit": "high",
                "costRange": "₹15,000–40,000"
            },
            {
                "id": "recharge-pit", "tier": "this_month",
                "title": "Recharge pit or percolation well",
                "whyItHelps": "Diverts runoff back to the aquifer.",
                "effort": "medium", "benefit": "high",
                "costRange": "₹5,000–20,000"
            },
            {
                "id": "greywater", "tier": "before_summer",
                "title": "Greywater reuse for irrigation",
                "whyItHelps": "Reduces groundwater demand by 20–30%.",
                "effort": "high", "benefit": "medium",
                "costRange": "₹20,000–50,000"
            }
        ]
    elif is_farm:
        measures = [
            {
                "id": "drip-irrigation", "tier": "this_week",
                "title": "Switch to drip irrigation",
                "whyItHelps": "Saves 40–60% water vs flood irrigation.",
                "effort": "medium", "benefit": "high",
                "costRange": "₹30,000–80,000/hectare (subsidy available)"
            },
            {
                "id": "mulching", "tier": "this_week",
                "title": "Apply mulch to reduce evaporation",
                "whyItHelps": "Reduces soil moisture loss by 25–30%.",
                "effort": "low", "benefit": "medium",
                "costRange": "₹2,000–5,000/hectare"
            },
            {
                "id": "crop-timing", "tier": "this_month",
                "title": "Shift crop timing to align with monsoon",
                "whyItHelps": "Reduces irrigation demand in dry months.",
                "effort": "medium", "benefit": "high",
                "costRange": "₹0 (planning change)"
            },
            {
                "id": "soil-moisture", "tier": "this_month",
                "title": "Soil moisture based irrigation",
                "whyItHelps": "Irrigate only when needed; saves 20–40%.",
                "effort": "medium", "benefit": "high",
                "costRange": "₹3,000–8,000 per sensor set"
            },
            {
                "id": "farm-pond", "tier": "before_summer",
                "title": "Farm pond or recharge well",
                "whyItHelps": "Stores runoff and recharges aquifer.",
                "effort": "high", "benefit": "high",
                "costRange": "₹50,000–1,50,000 (MNREGS support available)"
            }
        ]
    else:
        measures = [
            {
                "id": "monitoring", "tier": "this_week",
                "title": "Establish weekly monitoring schedule",
                "whyItHelps": "Data quality improves response time.",
                "effort": "low", "benefit": "high",
                "costRange": "₹0"
            },
            {
                "id": "community-outreach", "tier": "this_month",
                "title": "Community awareness campaign",
                "whyItHelps": "Behaviour change can reduce demand 10–20%.",
                "effort": "medium", "benefit": "medium",
                "costRange": "₹5,000–15,000"
            },
            {
                "id": "official-data", "tier": "this_month",
                "title": "Cross-reference with CGWB data",
                "whyItHelps": "Official benchmarks validate community readings.",
                "effort": "medium", "benefit": "high",
                "costRange": "₹0 (public data)"
            },
            {
                "id": "recharge-program", "tier": "before_summer",
                "title": "Area-wide aquifer recharge program",
                "whyItHelps": "Structured recharge can recover 0.2–0.5 m/year.",
                "effort": "high", "benefit": "high",
                "costRange": "₹1,00,000+ (government schemes available)"
            }
        ]

    status = well_or_locality.get("status", "WATCH")
    slope = well_or_locality.get("slopeMPerMonth")
    name = well_or_locality.get("name") or well_or_locality.get("locality", "your area")
    slope_desc = f"{slope:.2f} m/month" if slope else "unknown rate"

    return {
        "situation": (
            f"{name} has status {status} with a decline rate of {slope_desc}. "
            "These measures are indicative ranges only — consult a local expert for your situation."
        ),
        "measures": measures,
        "advisorySource": "template",
        "disclaimer": DISCLAIMER
    }


def template_chat(message: str, well_data: Optional[dict] = None) -> str:
    """Simple rule-based chat reply when Bedrock is unavailable."""
    msg_lower = message.lower()

    if well_data:
        name = well_data.get("name", "your borewell")
        slope = well_data.get("slopeMPerMonth")
        status = well_data.get("status", "NOT_ENOUGH_DATA")
        depth = well_data.get("latestDepthM")

        if "status" in msg_lower or "how" in msg_lower:
            status_text = {
                "CRITICAL": "in a critical state with rapid decline",
                "WATCH": "showing decline above normal thresholds",
                "NORMAL": "performing within normal range",
                "NOT_ENOUGH_DATA": "not yet assessed — more readings needed"
            }.get(status, "unknown")
            return (
                f"**{name}** is currently **{status_text}**. "
                f"Current depth: {depth} m. "
                f"Decline rate: {slope:.2f} m/month." if slope and depth
                else f"**{name}** is currently **{status_text}**."
            )

        if "save" in msg_lower or "conserve" in msg_lower or "plan" in msg_lower:
            return (
                "Key water-saving steps: fix leaks, pump only after 30 min pump-off, "
                "install sub-meters, consider rooftop rainwater harvesting, "
                "and build a recharge pit. "
                "Use the Water-Saving Plan feature for a detailed, role-specific plan."
            )

    return (
        "I'm a groundwater assistant for Borewell Ledger. "
        "I can help you understand water level trends, "
        "explain decline rates, compare with nearby wells, "
        "and suggest water-saving measures. "
        "Please select a specific well for detailed analysis. "
        f"\n\n*{DISCLAIMER}*"
    )
