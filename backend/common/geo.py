"""
geo.py - Geographic helpers for Borewell Ledger.
Uses haversine formula; no external dependencies.
"""
import math


INDIA_LAT_MIN = 6.0
INDIA_LAT_MAX = 37.5
INDIA_LON_MIN = 68.0
INDIA_LON_MAX = 97.5

GEOHASH_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Returns distance in kilometres between two lat/lon points."""
    R = 6371.0
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lon2 - lon1)
    a = math.sin(Δφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(Δλ / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def encode_geohash(lat: float, lon: float, precision: int = 5) -> str:
    """Encode lat/lon to geohash string of given precision."""
    lat_range = [-90.0, 90.0]
    lon_range = [-180.0, 180.0]
    bits = []
    is_lon = True

    for _ in range(precision * 5):
        if is_lon:
            mid = (lon_range[0] + lon_range[1]) / 2
            if lon >= mid:
                bits.append(1)
                lon_range[0] = mid
            else:
                bits.append(0)
                lon_range[1] = mid
        else:
            mid = (lat_range[0] + lat_range[1]) / 2
            if lat >= mid:
                bits.append(1)
                lat_range[0] = mid
            else:
                bits.append(0)
                lat_range[1] = mid
        is_lon = not is_lon

    result = []
    for i in range(0, len(bits), 5):
        chunk = bits[i:i + 5]
        idx = sum(b << (4 - j) for j, b in enumerate(chunk))
        result.append(GEOHASH_BASE32[idx])
    return "".join(result)


def is_inside_india(lat: float, lon: float) -> bool:
    """Returns True if coordinates are within India's bounding box."""
    return (INDIA_LAT_MIN <= lat <= INDIA_LAT_MAX and
            INDIA_LON_MIN <= lon <= INDIA_LON_MAX)


def round_coords(lat: float, lon: float, decimals: int = 3) -> tuple[float, float]:
    """Round coordinates to specified decimal places (~100m at decimals=3)."""
    return round(lat, decimals), round(lon, decimals)
