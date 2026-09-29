"""Productify Node Engine package for node lifecycle tracking, connection health, and timezone mathematics."""

from .timezone_math import (
    utc_now,
    utc_iso,
    parse_utc,
    get_zone_info,
    get_tz_name,
    to_local_tz,
    get_local_day_bounds_in_utc,
    slice_session_by_local_day,
    format_duration,
)
from .manager import (
    node_manager,
    NodeStatus,
    NodeRecord,
    NodeLifecycleManager,
)

__all__ = [
    "utc_now",
    "utc_iso",
    "parse_utc",
    "get_zone_info",
    "to_local_tz",
    "get_local_day_bounds_in_utc",
    "slice_session_by_local_day",
    "format_duration",
    "node_manager",
    "NodeStatus",
    "NodeRecord",
    "NodeLifecycleManager",
]

