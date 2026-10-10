#!/usr/bin/env python3
"""
seed.py - Idempotent seed script for Borewell Ledger.
Writes ~40 wells around Vadodara with 8-12 readings each.
Dates are relative to today so the 90-day window always has data.
Run with --reset to delete only seed items.

Usage:
  python scripts/seed.py --stack-name borewell-ledger
  python scripts/seed.py --stack-name borewell-ledger --reset
"""

import argparse
import boto3
import json
import random
import math
import uuid
import sys
import os
from datetime import date, timedelta
from decimal import Decimal

# Fixed seed for determinism
random.seed(2024)

STACK_NAME = "borewell-ledger"
VADODARA_CENTER = (22.3072, 73.1812)

LOCALITIES = [
    "Alkapuri", "Gotri", "Manjalpur", "Karelibaug", "Akota", "Waghodia Road"
]

SOCIETY_NAMES = [
    "Sunrise Heights Society Borewell",
    "Green Valley Cooperative Borewell",
    "Shree Ganesh Society Well",
    "Lotus Garden Apartments Borewell",
    "Silver Oak Society Borewell",
    "Nilamber Heights Borewell",
    "Saraswati Nagar Society Well",
    "Navkar Residency Borewell",
]

FARM_NAMES = [
    "Patel Farm Well 1",
    "Patel Farm Well 2",
    "Desai Agriculture Borewell",
    "Shah Nursery Well",
    "Chauhan Farm Borewell",
    "Vasant Farm Well",
]

OTHER_NAMES = [
    "Municipal Standpipe Well",
    "School Campus Borewell",
    "Temple Trust Borewell",
    "Health Centre Borewell",
    "Roadside Sampling Point",
]


def get_stack_outputs(stack_name: str) -> dict:
    cf = boto3.client("cloudformation")
    resp = cf.describe_stacks(StackName=stack_name)
    outputs = {}
    for o in resp["Stacks"][0].get("Outputs", []):
        outputs[o["OutputKey"]] = o["OutputValue"]
    return outputs


def haversine_offset(lat: float, lon: float, dx_km: float, dy_km: float) -> tuple:
    """Offset lat/lon by dx_km east and dy_km north."""
    R = 6371.0
    new_lat = lat + (dy_km / R) * (180 / math.pi)
    new_lon = lon + (dx_km / (R * math.cos(math.radians(lat)))) * (180 / math.pi)
    return round(new_lat, 3), round(new_lon, 3)


def encode_geohash(lat: float, lon: float, precision: int = 5) -> str:
    base32 = "0123456789bcdefghjkmnpqrstuvwxyz"
    lat_range = [-90.0, 90.0]
    lon_range = [-180.0, 180.0]
    bits = []
    is_lon = True
    for _ in range(precision * 5):
        if is_lon:
            mid = (lon_range[0] + lon_range[1]) / 2
            if lon >= mid:
                bits.append(1); lon_range[0] = mid
            else:
                bits.append(0); lon_range[1] = mid
        else:
            mid = (lat_range[0] + lat_range[1]) / 2
            if lat >= mid:
                bits.append(1); lat_range[0] = mid
            else:
                bits.append(0); lat_range[1] = mid
        is_lon = not is_lon
    result = []
    for i in range(0, len(bits), 5):
        chunk = bits[i:i+5]
        idx = sum(b << (4 - j) for j, b in enumerate(chunk))
        result.append(base32[idx])
    return "".join(result)


def generate_readings(start_depth: float, slope_mpm: float,
                      count: int, max_days_ago: int, noise: float = 0.15) -> list:
    """Generate readings with realistic seasonal shape."""
    today = date.today()
    readings = []
    # Spread over max_days_ago
    step = max_days_ago // count
    for i in range(count):
        days_ago = max_days_ago - i * step + random.randint(-3, 3)
        days_ago = max(1, min(days_ago, max_days_ago))
        d = today - timedelta(days=days_ago)
        months_from_start = (max_days_ago - days_ago) / 30.4375
        depth = start_depth + slope_mpm * months_from_start
        depth += random.gauss(0, noise)
        depth = round(max(1.0, depth), 2)
        readings.append({"date": d.isoformat(), "depthM": depth})

    # Deduplicate by date
    seen = {}
    for r in readings:
        seen[r["date"]] = r
    return sorted(seen.values(), key=lambda r: r["date"])


def seed(tables: dict, dry_run: bool = False) -> int:
    """Seed wells and readings. Returns count of wells seeded."""
    wells_table = boto3.resource("dynamodb").Table(tables["WellsTableName"])
    readings_table = boto3.resource("dynamodb").Table(tables["ReadingsTableName"])

    wells = []

    # Locality offsets from Vadodara center (dx km, dy km)
    locality_offsets = {
        "Alkapuri":      (-2.0, 1.0),
        "Gotri":         (2.5, 2.0),
        "Manjalpur":     (0.0, -3.0),
        "Karelibaug":    (3.0, 0.5),
        "Akota":         (-3.5, -1.0),
        "Waghodia Road": (5.0, -1.5),
    }

    # Slope profiles: (label, slope_mpm, status_expected)
    # 4 CRITICAL wells: 0.9-1.3 m/month
    # 6 WATCH wells: 0.3-0.5 m/month
    # 1 locality area alert: 8 wells at ~0.6 m/month
    # Rest: NORMAL 0.05-0.2 m/month

    well_configs = []

    # Alkapuri - area alert locality (8 wells at 0.6 m/month)
    for i in range(8):
        well_configs.append({
            "locality": "Alkapuri",
            "slope": 0.55 + random.uniform(0, 0.1),
            "owner_type": random.choice(["society", "farm", "other"]),
            "start_depth": 18.0 + random.uniform(0, 5),
            "pump_depth": 60.0 + random.uniform(0, 10) if random.random() > 0.5 else None,
        })

    # 4 CRITICAL wells spread across localities
    critical_localities = ["Gotri", "Manjalpur", "Karelibaug", "Waghodia Road"]
    for loc in critical_localities:
        well_configs.append({
            "locality": loc,
            "slope": random.uniform(0.9, 1.3),
            "owner_type": random.choice(["society", "farm"]),
            "start_depth": 20.0 + random.uniform(0, 8),
            "pump_depth": 55.0 + random.uniform(0, 15) if random.random() > 0.4 else None,
        })

    # 6 WATCH wells
    watch_localities = ["Gotri", "Manjalpur", "Karelibaug", "Akota", "Alkapuri", "Waghodia Road"]
    for loc in watch_localities:
        well_configs.append({
            "locality": loc,
            "slope": random.uniform(0.3, 0.55),
            "owner_type": random.choice(["society", "farm", "other"]),
            "start_depth": 15.0 + random.uniform(0, 5),
            "pump_depth": 50.0 + random.uniform(0, 10) if random.random() > 0.5 else None,
        })

    # Remaining NORMAL wells to reach ~40 total
    remaining = 40 - len(well_configs)
    for i in range(remaining):
        loc = random.choice(LOCALITIES)
        well_configs.append({
            "locality": loc,
            "slope": random.uniform(0.02, 0.25),
            "owner_type": random.choice(["society", "farm", "other"]),
            "start_depth": 12.0 + random.uniform(0, 10),
            "pump_depth": 45.0 + random.uniform(0, 15) if random.random() > 0.45 else None,
        })

    now_iso = date.today().isoformat() + "T00:00:00"
    seeded_count = 0

    for i, config in enumerate(well_configs):
        loc = config["locality"]
        offset = locality_offsets.get(loc, (0, 0))
        # Add per-well scatter
        lat, lon = haversine_offset(
            VADODARA_CENTER[0], VADODARA_CENTER[1],
            offset[0] + random.uniform(-0.8, 0.8),
            offset[1] + random.uniform(-0.8, 0.8)
        )

        owner_type = config["owner_type"]
        if owner_type == "society":
            name = random.choice(SOCIETY_NAMES) + f" ({loc})"
        elif owner_type == "farm":
            name = random.choice(FARM_NAMES)
        else:
            name = random.choice(OTHER_NAMES)

        # Make name unique
        name = name[:77] + f" {i+1}"

        well_id = f"seed-well-{i+1:03d}"
        geohash = encode_geohash(lat, lon, 5)

        readings = generate_readings(
            start_depth=config["start_depth"],
            slope_mpm=config["slope"],
            count=random.randint(8, 12),
            max_days_ago=240,  # 8 months back
            noise=0.12
        )

        # Latest values
        latest = max(readings, key=lambda r: r["date"])
        latest_depth = latest["depthM"]
        latest_date = latest["date"]

        well_item = {
            "wellId": well_id,
            "name": name[:80],
            "ownerType": owner_type,
            "locality": loc,
            "lat": Decimal(str(lat)),
            "lon": Decimal(str(lon)),
            "geohash5": geohash,
            "source": "seed",
            "createdAt": now_iso,
            "status": "NOT_ENOUGH_DATA",  # Will be set by analyzer
            "latestDepthM": Decimal(str(latest_depth)),
            "latestDate": latest_date,
            "slopeMPerMonth": None,
            "peerMedian": None,
            "peerCount": 0
        }
        if config.get("pump_depth"):
            well_item["pumpDepthM"] = Decimal(str(round(config["pump_depth"], 1)))

        if not dry_run:
            wells_table.put_item(Item=well_item)

        # Write readings
        for r in readings:
            reading_item = {
                "wellId": well_id,
                "date": r["date"],
                "depthM": Decimal(str(r["depthM"])),
                "source": "seed",
                "createdAt": now_iso
            }
            if not dry_run:
                readings_table.put_item(Item=reading_item)

        wells.append(well_item)
        seeded_count += 1
        print(f"  Seeded well {i+1}/{len(well_configs)}: {name[:50]}... ({loc}, slope={config['slope']:.2f})")

    print(f"\n✓ Seeded {seeded_count} wells with readings")
    return seeded_count


def reset_seed(tables: dict) -> None:
    """Delete only items with source: seed."""
    print("Resetting seed data...")
    ddb = boto3.resource("dynamodb")
    wells_table = ddb.Table(tables["WellsTableName"])
    readings_table = ddb.Table(tables["ReadingsTableName"])

    # Scan for seed wells
    wells = []
    kwargs = {"FilterExpression": "source = :s",
              "ExpressionAttributeValues": {":s": "seed"}}
    while True:
        resp = wells_table.scan(**kwargs)
        wells.extend(resp.get("Items", []))
        if "LastEvaluatedKey" not in resp:
            break
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]

    print(f"Found {len(wells)} seed wells to delete")
    for w in wells:
        well_id = w["wellId"]
        wells_table.delete_item(Key={"wellId": well_id})

        # Delete readings
        readings = []
        from boto3.dynamodb.conditions import Key
        rk = {"KeyConditionExpression": Key("wellId").eq(well_id)}
        while True:
            resp = readings_table.query(**rk)
            readings.extend(resp.get("Items", []))
            if "LastEvaluatedKey" not in resp:
                break
            rk["ExclusiveStartKey"] = resp["LastEvaluatedKey"]

        for r in readings:
            readings_table.delete_item(Key={"wellId": well_id, "date": r["date"]})

        print(f"  Deleted well {well_id} and {len(readings)} readings")

    print("✓ Seed data reset complete")


def invoke_analyzer(tables: dict) -> None:
    """Invoke the analyzer Lambda to compute statuses."""
    print("\nInvoking analyzer Lambda...")
    # Import and run directly if tables are available
    os.environ["WELLS_TABLE"] = tables["WellsTableName"]
    os.environ["READINGS_TABLE"] = tables["ReadingsTableName"]
    os.environ["ALERTS_TABLE"] = tables["AlertsTableName"]
    os.environ["META_TABLE"] = tables["MetaTableName"]
    os.environ["SNS_TOPIC_ARN"] = tables.get("SnsTopicArn", "")

    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + "/backend")

    try:
        from handlers.analyzer import run_analysis
        stats = run_analysis()
        print(f"✓ Analyzer complete: {json.dumps(stats, indent=2)}")
    except Exception as e:
        print(f"⚠ Analyzer invoke failed: {e}")
        print("  Run manually: aws lambda invoke --function-name AnalyzerFunction ...")


def main():
    parser = argparse.ArgumentParser(description="Seed Borewell Ledger data")
    parser.add_argument("--stack-name", default=STACK_NAME)
    parser.add_argument("--reset", action="store_true", help="Delete seed data")
    parser.add_argument("--dry-run", action="store_true", help="Don't write to DynamoDB")
    parser.add_argument("--region", default="ap-south-1")
    args = parser.parse_args()

    boto3.setup_default_session(region_name=args.region)

    print(f"Getting stack outputs for: {args.stack_name}")
    try:
        tables = get_stack_outputs(args.stack_name)
    except Exception as e:
        print(f"✗ Failed to get stack outputs: {e}")
        print("  Make sure the stack is deployed: sam deploy")
        sys.exit(1)

    print(f"Tables: {json.dumps({k: v for k, v in tables.items() if 'Table' in k or 'Sns' in k}, indent=2)}")

    if args.reset:
        reset_seed(tables)
        return

    print(f"\nSeeding ~40 wells around Vadodara...")
    print("NOTE: All data is simulated demo data, labeled source=seed\n")
    count = seed(tables, dry_run=args.dry_run)

    if not args.dry_run:
        invoke_analyzer(tables)

    print(f"\n✓ Done. {count} wells seeded.")
    print("  Visit the app to see the seeded data (labeled 'Demo data')")


if __name__ == "__main__":
    main()
