"""
ddb.py - DynamoDB helpers for Borewell Ledger.
Thin wrappers; no ORM.
"""
import os
import boto3
from boto3.dynamodb.conditions import Key, Attr
from typing import Optional

_dynamodb = None


def get_dynamodb():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb")
    return _dynamodb


def get_table(env_var: str):
    table_name = os.environ[env_var]
    return get_dynamodb().Table(table_name)


def wells_table():
    return get_table("WELLS_TABLE")


def readings_table():
    return get_table("READINGS_TABLE")


def alerts_table():
    return get_table("ALERTS_TABLE")


def meta_table():
    return get_table("META_TABLE")


def scan_all(table, filter_expr=None, index_name=None) -> list[dict]:
    """Scan entire table (or index) with auto-pagination. Use sparingly."""
    kwargs = {}
    if filter_expr is not None:
        kwargs["FilterExpression"] = filter_expr
    if index_name is not None:
        kwargs["IndexName"] = index_name

    items = []
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        if "LastEvaluatedKey" not in resp:
            break
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
    return items


def query_all(table, key_condition, index_name=None, **kwargs) -> list[dict]:
    """Query with auto-pagination."""
    params = {"KeyConditionExpression": key_condition}
    if index_name:
        params["IndexName"] = index_name
    params.update(kwargs)

    items = []
    while True:
        resp = table.query(**params)
        items.extend(resp.get("Items", []))
        if "LastEvaluatedKey" not in resp:
            break
        params["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
    return items


def get_readings_for_well(well_id: str) -> list[dict]:
    return query_all(
        readings_table(),
        Key("wellId").eq(well_id)
    )


def get_all_wells() -> list[dict]:
    return scan_all(wells_table())
