"""Unit and integration tests for Productify Node Engine and Timezone Mathematics."""

import unittest
import asyncio
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from unittest.mock import AsyncMock, MagicMock

from node_engine.timezone_math import (
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
from node_engine.manager import NodeLifecycleManager, NodeStatus, NodeRecord


class TestTimezoneMathematics(unittest.TestCase):
    """Test suite for strict timezone-aware operations and midnight slicing."""

    def test_utc_now_and_iso_roundtrip(self):
        now = utc_now()
        self.assertEqual(now.tzinfo, timezone.utc)
        iso_str = utc_iso(now)
        self.assertTrue("+00:00" in iso_str or iso_str.endswith("Z"))
        parsed = parse_utc(iso_str)
        self.assertLess(abs((parsed - now).total_seconds()), 0.001)

    def test_get_zone_info_aliases_and_fallback(self):
        tz_ist = get_zone_info("IST")
        self.assertEqual(get_tz_name(tz_ist), "Asia/Kolkata")

        tz_ny = get_zone_info("EST")
        self.assertEqual(get_tz_name(tz_ny), "America/New_York")

        tz_invalid = get_zone_info("NonExistent/Timezone")
        self.assertIn(get_tz_name(tz_invalid), ("UTC", "datetime.timezone.utc"))

    def test_to_local_tz(self):
        # 12:00:00 UTC -> 17:30:00 IST (+05:30)
        utc_dt = datetime(2026, 9, 29, 12, 0, 0, tzinfo=timezone.utc)
        ist_dt = to_local_tz(utc_dt, "Asia/Kolkata")
        self.assertEqual(ist_dt.hour, 17)
        self.assertEqual(ist_dt.minute, 30)
        self.assertEqual(ist_dt.day, 29)

    def test_get_local_day_bounds_in_utc(self):
        # For 2026-09-29 in Asia/Kolkata (+05:30):
        # 00:00:00 IST is 2026-09-28 18:30:00 UTC
        # 23:59:59.999999 IST is 2026-09-29 18:29:59.999999 UTC
        start_utc, end_utc = get_local_day_bounds_in_utc("2026-09-29", "Asia/Kolkata")
        self.assertEqual(start_utc.year, 2026)
        self.assertEqual(start_utc.month, 9)
        self.assertEqual(start_utc.day, 28)
        self.assertEqual(start_utc.hour, 18)
        self.assertEqual(start_utc.minute, 30)

        self.assertEqual(end_utc.year, 2026)
        self.assertEqual(end_utc.month, 9)
        self.assertEqual(end_utc.day, 29)
        self.assertEqual(end_utc.hour, 18)
        self.assertEqual(end_utc.minute, 29)

    def test_slice_session_within_single_day(self):
        # 2 hours session entirely on 2026-09-29 in UTC
        start = datetime(2026, 9, 29, 10, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 9, 29, 12, 0, 0, tzinfo=timezone.utc)
        slices = slice_session_by_local_day(start, end, "UTC")
        self.assertEqual(len(slices), 1)
        self.assertEqual(slices[0]["local_date"], "2026-09-29")
        self.assertEqual(slices[0]["duration_seconds"], 7200.0)
        self.assertEqual(slices[0]["hours"], 2.0)

    def test_slice_session_spanning_midnight(self):
        # Session in Asia/Kolkata (+05:30):
        # Starts 2026-09-28 17:30 UTC -> 23:00 IST (1 hour on Sept 28)
        # Ends 2026-09-28 20:30 UTC -> 02:00 IST (2 hours on Sept 29)
        start = datetime(2026, 9, 28, 17, 30, 0, tzinfo=timezone.utc)
        end = datetime(2026, 9, 28, 20, 30, 0, tzinfo=timezone.utc)
        slices = slice_session_by_local_day(start, end, "Asia/Kolkata")

        self.assertEqual(len(slices), 2)
        self.assertEqual(slices[0]["local_date"], "2026-09-28")
        self.assertAlmostEqual(slices[0]["duration_seconds"], 3600.0, delta=1.0)
        self.assertEqual(slices[1]["local_date"], "2026-09-29")
        self.assertAlmostEqual(slices[1]["duration_seconds"], 7200.0, delta=1.0)

    def test_format_duration(self):
        self.assertEqual(format_duration(45), "45s")
        self.assertEqual(format_duration(125), "2m 5s")
        self.assertEqual(format_duration(3665), "1h 1m 5s")


class TestNodeLifecycleManager(unittest.IsolatedAsyncioTestCase):
    """Test suite for Node lifecycle transitions, state evaluation, and watchdog."""

    async def test_initial_state_and_heartbeat_online_idle(self):
        mgr = NodeLifecycleManager(timeout_seconds=45.0)
        node = mgr.get_or_create_node("rental-101", "node-gpu-1")
        self.assertEqual(node.status, NodeStatus.DISCONNECTED)

        # Send heartbeat with is_live=True and active_pods=0 -> ONLINE_IDLE
        payload = {
            "status": "LIVE",
            "is_live": True,
            "active_pods": 0,
            "client_timezone": "Asia/Kolkata",
            "thermal": {"status": "NORMAL", "temperature_c": 58},
        }
        await mgr.record_heartbeat("rental-101", payload, transport="websocket")

        self.assertEqual(node.status, NodeStatus.ONLINE_IDLE)
        self.assertTrue(node.is_live)
        self.assertEqual(node.active_pods, 0)
        self.assertEqual(node.client_timezone, "Asia/Kolkata")
        self.assertEqual(node.transport, "websocket")

    async def test_transition_to_in_use_and_paused(self):
        mgr = NodeLifecycleManager(timeout_seconds=45.0)
        node = mgr.get_or_create_node("rental-102")

        # 1. Heartbeat with active_pods=1 -> IN_USE
        await mgr.record_heartbeat("rental-102", {"is_live": True, "active_pods": 1})
        self.assertEqual(node.status, NodeStatus.IN_USE)

        # 2. Host pauses node -> PAUSED
        await mgr.record_heartbeat("rental-102", {"is_live": False, "active_pods": 0})
        self.assertEqual(node.status, NodeStatus.PAUSED)

        # 3. Host unpauses node -> ONLINE_IDLE
        await mgr.record_heartbeat("rental-102", {"is_live": True, "active_pods": 0})
        self.assertEqual(node.status, NodeStatus.ONLINE_IDLE)

    async def test_gaming_ready_node_heartbeat(self):
        mgr = NodeLifecycleManager(timeout_seconds=45.0)
        node = mgr.get_or_create_node("rental-gaming-1", "node-pc-01")
        self.assertFalse(node.gaming_ready)

        # Heartbeat reporting gaming ready
        await mgr.record_heartbeat("rental-gaming-1", {
            "node_id": "node-pc-01",
            "is_live": True,
            "gaming_ready": True,
            "hardware": {"gpu": "RTX 4090", "sunshine_installed": True, "vigem_installed": True}
        })
        self.assertTrue(node.gaming_ready)
        d = node.to_dict()
        self.assertTrue(d["gaming_ready"])
        self.assertEqual(d["node_id"], "node-pc-01")

    async def test_watchdog_timeout_triggers_disconnect(self):
        mgr = NodeLifecycleManager(timeout_seconds=2.0)
        node = mgr.get_or_create_node("rental-103")
        await mgr.record_heartbeat("rental-103", {"is_live": True, "active_pods": 0})
        self.assertEqual(node.status, NodeStatus.ONLINE_IDLE)

        # Fast forward time beyond 2 seconds timeout
        node.last_seen -= 5.0
        await mgr.watchdog_tick()

        self.assertEqual(node.status, NodeStatus.DISCONNECTED)

    async def test_compute_session_persisted_to_db_on_transition(self):
        mgr = NodeLifecycleManager(timeout_seconds=45.0)
        mock_db = MagicMock()
        mock_db.node_compute_sessions.insert_one = AsyncMock()
        mock_db.rentals.update_one = AsyncMock()
        mgr.set_db(mock_db)

        node = mgr.get_or_create_node("rental-104")
        # Enter IN_USE
        await mgr.record_heartbeat("rental-104", {"is_live": True, "active_pods": 1})
        self.assertEqual(node.status, NodeStatus.IN_USE)

        # Simulate 10 seconds passing
        node.state_entered_at = datetime.now(timezone.utc) - timedelta(seconds=10)

        # Transition back to ONLINE_IDLE
        await mgr.record_heartbeat("rental-104", {"is_live": True, "active_pods": 0})
        self.assertEqual(node.status, NodeStatus.ONLINE_IDLE)

        # Verify db insert was called with billable session
        self.assertTrue(mock_db.node_compute_sessions.insert_one.called)
        call_args = mock_db.node_compute_sessions.insert_one.call_args[0][0]
        self.assertEqual(call_args["rental_id"], "rental-104")
        self.assertEqual(call_args["state"], "IN_USE")
        self.assertTrue(call_args["is_billable"])
        self.assertGreaterEqual(call_args["duration_seconds"], 9.0)


if __name__ == "__main__":
    unittest.main()
