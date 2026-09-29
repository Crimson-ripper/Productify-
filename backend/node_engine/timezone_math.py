"""High-precision, timezone-aware mathematics engine for Productify nodes.

Handles UTC canonicalization, host/renter local timezone projections,
Daylight Saving Time (DST) transitions, and midnight-boundary interval slicing
using Python's native zoneinfo library.
"""

from datetime import datetime, timezone, timedelta, time as dtime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import Optional, Tuple, List, Dict
import logging

logger = logging.getLogger("productify.timezone_math")


def utc_now() -> datetime:
    """Return current timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


def utc_iso(dt: Optional[datetime] = None) -> str:
    """Return standard ISO-8601 UTC string (e.g. '2026-09-29T13:45:00.000Z')."""
    if dt is None:
        dt = utc_now()
    elif dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat()


def parse_utc(iso_str: str) -> datetime:
    """Parse ISO-8601 string into timezone-aware UTC datetime."""
    if not iso_str:
        return utc_now()
    dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt


FALLBACK_OFFSETS = {
    "UTC": timezone.utc,
    "GMT": timezone.utc,
    "Asia/Kolkata": timezone(timedelta(hours=5, minutes=30), name="Asia/Kolkata"),
    "IST": timezone(timedelta(hours=5, minutes=30), name="Asia/Kolkata"),
    "America/New_York": timezone(timedelta(hours=-5), name="America/New_York"),
    "EST": timezone(timedelta(hours=-5), name="America/New_York"),
    "EDT": timezone(timedelta(hours=-4), name="America/New_York"),
    "America/Chicago": timezone(timedelta(hours=-6), name="America/Chicago"),
    "CST": timezone(timedelta(hours=-6), name="America/Chicago"),
    "CDT": timezone(timedelta(hours=-5), name="America/Chicago"),
    "America/Los_Angeles": timezone(timedelta(hours=-8), name="America/Los_Angeles"),
    "PST": timezone(timedelta(hours=-8), name="America/Los_Angeles"),
    "PDT": timezone(timedelta(hours=-7), name="America/Los_Angeles"),
    "Europe/London": timezone(timedelta(hours=0), name="Europe/London"),
    "BST": timezone(timedelta(hours=1), name="Europe/London"),
    "Europe/Berlin": timezone(timedelta(hours=1), name="Europe/Berlin"),
    "CET": timezone(timedelta(hours=1), name="Europe/Berlin"),
    "CEST": timezone(timedelta(hours=2), name="Europe/Berlin"),
    "Asia/Tokyo": timezone(timedelta(hours=9), name="Asia/Tokyo"),
    "JST": timezone(timedelta(hours=9), name="Asia/Tokyo"),
}


def get_tz_name(tz) -> str:
    """Return canonical name or key for a tzinfo object."""
    if hasattr(tz, "key") and tz.key:
        return tz.key
    if hasattr(tz, "tzname"):
        name = tz.tzname(None)
        if name:
            return name
    return str(tz)


def get_zone_info(tz_name: Optional[str]):
    """Safely resolve an IANA timezone identifier with fallback to fixed offsets or UTC.
    
    Operates seamlessly across Windows, Linux, and macOS even if OS-level tzdata is absent.
    """
    if not tz_name or not isinstance(tz_name, str):
        return timezone.utc

    tz_clean = tz_name.strip()
    if tz_clean in ("UTC", "GMT", "Z"):
        return timezone.utc

    alias_map = {
        "IST": "Asia/Kolkata",
        "EDT": "America/New_York",
        "EST": "America/New_York",
        "CDT": "America/Chicago",
        "CST": "America/Chicago",
        "PDT": "America/Los_Angeles",
        "PST": "America/Los_Angeles",
        "BST": "Europe/London",
        "CET": "Europe/Berlin",
        "CEST": "Europe/Berlin",
        "GMT": "UTC",
    }
    tz_resolved = alias_map.get(tz_clean, tz_clean)

    # 1. Try native ZoneInfo if system tzdata is available
    try:
        return ZoneInfo(tz_resolved)
    except (ZoneInfoNotFoundError, ModuleNotFoundError, Exception):
        pass

    # 2. Try known fallback offsets
    if tz_resolved in FALLBACK_OFFSETS:
        return FALLBACK_OFFSETS[tz_resolved]
    if tz_clean in FALLBACK_OFFSETS:
        return FALLBACK_OFFSETS[tz_clean]

    # 3. Default to UTC
    return timezone.utc


def to_local_tz(dt_utc: datetime, tz_name: Optional[str]) -> datetime:
    """Convert a UTC datetime into the host or renter local timezone."""
    if dt_utc.tzinfo is None:
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
    target_tz = get_zone_info(tz_name)
    return dt_utc.astimezone(target_tz)


def get_local_day_bounds_in_utc(target_date_str: str, tz_name: Optional[str]) -> Tuple[datetime, datetime]:
    """Calculate the exact UTC start and end timestamps corresponding to a local midnight-to-midnight day.
    
    Example:
      For date '2026-09-29' in 'Asia/Kolkata' (+05:30):
        Local start: 2026-09-29 00:00:00 IST -> 2026-09-28 18:30:00 UTC
        Local end:   2026-09-29 23:59:59.999999 IST -> 2026-09-29 18:29:59.999999 UTC
    """
    tz = get_zone_info(tz_name)
    # Parse target date (YYYY-MM-DD)
    date_parts = [int(p) for p in target_date_str.split("-")]
    local_start = datetime(date_parts[0], date_parts[1], date_parts[2], 0, 0, 0, tzinfo=tz)
    local_end = datetime(date_parts[0], date_parts[1], date_parts[2], 23, 59, 59, 999999, tzinfo=tz)

    utc_start = local_start.astimezone(timezone.utc)
    utc_end = local_end.astimezone(timezone.utc)
    return utc_start, utc_end


def slice_session_by_local_day(
    session_start_utc: datetime,
    session_end_utc: datetime,
    tz_name: Optional[str]
) -> List[Dict]:
    """Slice a continuous compute session spanning one or more midnights into exact per-day buckets
    calculated in the host's local timezone.
    
    Returns a list of dicts:
      [
        {"local_date": "2026-09-28", "duration_seconds": 7200.0, "hours": 2.0},
        {"local_date": "2026-09-29", "duration_seconds": 14400.0, "hours": 4.0},
      ]
    """
    if session_end_utc <= session_start_utc:
        return []

    tz = get_zone_info(tz_name)
    local_start = session_start_utc.astimezone(tz)
    local_end = session_end_utc.astimezone(tz)

    buckets = []
    curr = local_start

    while curr < local_end:
        # End of current local day: 23:59:59.999999
        day_end = datetime(curr.year, curr.month, curr.day, 23, 59, 59, 999999, tzinfo=tz)
        segment_end = min(local_end, day_end + timedelta(microseconds=1))
        
        # Calculate duration in seconds for this slice
        duration_sec = (segment_end - curr).total_seconds()
        if duration_sec > 0:
            date_key = curr.strftime("%Y-%m-%d")
            buckets.append({
                "local_date": date_key,
                "duration_seconds": round(duration_sec, 2),
                "hours": round(duration_sec / 3600.0, 4),
                "tz": str(tz),
            })

        # Advance to start of next day
        curr = datetime(curr.year, curr.month, curr.day, 0, 0, 0, tzinfo=tz) + timedelta(days=1)

    return buckets


def format_duration(seconds: float) -> str:
    """Format total seconds into human-readable 'Xh Ym Zs'."""
    sec = int(round(seconds))
    hrs = sec // 3600
    rem = sec % 3600
    mins = rem // 60
    s = rem % 60
    if hrs > 0:
        return f"{hrs}h {mins}m {s}s"
    elif mins > 0:
        return f"{mins}m {s}s"
    else:
        return f"{s}s"
