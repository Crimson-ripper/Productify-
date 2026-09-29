"""Node Lifecycle Manager for Productify.

Maintains live connection state, evaluates operational modes (ONLINE_IDLE, IN_USE,
PAUSED, DISCONNECTED), tracks compute sessions, and handles timeout watchdogs.
"""

import time
import asyncio
import logging
from enum import Enum
from typing import Dict, Optional, Any, List
from datetime import datetime, timezone

from .timezone_math import utc_now, utc_iso, parse_utc, get_zone_info, format_duration

logger = logging.getLogger("productify.node_manager")


class NodeStatus(str, Enum):
    ONLINE_IDLE = "ONLINE_IDLE"    # Online, ready, zero active tenant pods
    IN_USE = "IN_USE"              # Online and currently running tenant workload
    PAUSED = "PAUSED"              # Host manually toggled node to paused/offline
    DISCONNECTED = "DISCONNECTED"  # Missed heartbeats (>45s timeout)


class NodeRecord:
    """In-memory tracking record for a connected physical GPU/compute node."""

    def __init__(self, rental_id: str, node_id: Optional[str] = None):
        self.rental_id = rental_id
        self.node_id = node_id or rental_id
        self.status: NodeStatus = NodeStatus.DISCONNECTED
        self.last_seen: float = 0.0
        self.client_timezone: str = "UTC"
        self.is_live: bool = False
        self.active_pods: int = 0
        self.transport: str = "none"
        self.thermal: Dict[str, Any] = {}
        self.hardware: Dict[str, Any] = {}

        # Session tracking
        self.state_entered_at: datetime = utc_now()
        self.session_id: Optional[str] = None
        self.total_uptime_sec: float = 0.0
        self.total_in_use_sec: float = 0.0

    @property
    def current_state_duration_seconds(self) -> float:
        """Seconds spent in the current operational state."""
        return max(0.0, (utc_now() - self.state_entered_at).total_seconds())

    def to_dict(self) -> Dict[str, Any]:
        """Convert live node metrics to a serializable dictionary."""
        is_connected = (self.status != NodeStatus.DISCONNECTED)
        return {
            "rental_id": self.rental_id,
            "node_id": self.node_id,
            "status": self.status.value,
            "is_connected": is_connected,
            "is_live": self.is_live,
            "active_pods": self.active_pods,
            "transport": self.transport,
            "last_seen_sec_ago": round(time.time() - self.last_seen, 1) if self.last_seen else None,
            "client_timezone": self.client_timezone,
            "state_entered_at": utc_iso(self.state_entered_at),
            "state_duration_sec": round(self.current_state_duration_seconds, 1),
            "state_duration_formatted": format_duration(self.current_state_duration_seconds),
            "thermal": self.thermal,
            "hardware": self.hardware,
        }


class NodeLifecycleManager:
    """Central server-side manager orchestrating node liveness, state transitions, and sessions."""

    def __init__(self, timeout_seconds: float = 45.0):
        self.timeout_seconds = timeout_seconds
        self.nodes: Dict[str, NodeRecord] = {}
        self._lock = asyncio.Lock()
        self.db = None  # Injected on startup

    def set_db(self, database):
        self.db = database

    def get_or_create_node(self, rental_id: str, node_id: Optional[str] = None) -> NodeRecord:
        if rental_id not in self.nodes:
            self.nodes[rental_id] = NodeRecord(rental_id, node_id)
        elif node_id:
            self.nodes[rental_id].node_id = node_id
        return self.nodes[rental_id]

    async def record_heartbeat(
        self,
        rental_id: str,
        payload: Dict[str, Any],
        transport: str = "long_poll"
    ) -> NodeRecord:
        """Process incoming heartbeat from host node and update state machine."""
        now_ts = time.time()
        node = self.get_or_create_node(rental_id, payload.get("node_id"))

        node.last_seen = now_ts
        node.transport = transport
        node.is_live = bool(payload.get("is_live", payload.get("status") == "LIVE"))
        node.active_pods = int(payload.get("active_pods", 0))
        node.client_timezone = payload.get("client_timezone") or node.client_timezone or "UTC"

        if "thermal" in payload:
            node.thermal = payload["thermal"]
        if "hardware" in payload:
            node.hardware = payload["hardware"]

        # Evaluate new operational state
        if not node.is_live:
            new_status = NodeStatus.PAUSED
        elif node.active_pods > 0:
            new_status = NodeStatus.IN_USE
        else:
            new_status = NodeStatus.ONLINE_IDLE

        # Transition state if changed
        if node.status != new_status:
            await self._transition_state(node, new_status)

        return node

    async def _transition_state(self, node: NodeRecord, new_status: NodeStatus):
        """Execute state transition, finalize previous session chunk, and persist audit event."""
        old_status = node.status
        ended_at = utc_now()
        started_at = node.state_entered_at
        duration = max(0.0, (ended_at - started_at).total_seconds())

        # Update in-memory counters
        if old_status in [NodeStatus.ONLINE_IDLE, NodeStatus.IN_USE]:
            node.total_uptime_sec += duration
        if old_status == NodeStatus.IN_USE:
            node.total_in_use_sec += duration

        # Persist session chunk to MongoDB
        if self.db is not None and old_status != NodeStatus.DISCONNECTED and duration >= 1.0:
            try:
                session_doc = {
                    "rental_id": node.rental_id,
                    "node_id": node.node_id,
                    "state": old_status.value,
                    "started_at": utc_iso(started_at),
                    "ended_at": utc_iso(ended_at),
                    "duration_seconds": round(duration, 2),
                    "hours": round(duration / 3600.0, 4),
                    "client_timezone": node.client_timezone,
                    "is_billable": (old_status == NodeStatus.IN_USE),
                    "recorded_at": utc_iso(),
                }
                await self.db.node_compute_sessions.insert_one(session_doc)
            except Exception as e:
                logger.warning(f"Error persisting compute session: {e}")

        # Update node state
        node.status = new_status
        node.state_entered_at = ended_at
        logger.info(
            f"Node '{node.rental_id}' state transition: {old_status.value} -> {new_status.value} "
            f"(prev duration: {format_duration(duration)})"
        )

        # Sync rental document in database
        if self.db is not None:
            try:
                update_fields = {
                    "connection_status": new_status.value,
                    "is_online": (new_status != NodeStatus.DISCONNECTED),
                    "last_seen_at": utc_iso(),
                    "active_pods": node.active_pods,
                    "thermal_status": node.thermal.get("status", "NORMAL"),
                }
                await self.db.rentals.update_one({"id": node.rental_id}, {"$set": update_fields})
            except Exception as e:
                logger.debug(f"Error syncing rental connection status in db: {e}")

    async def watchdog_tick(self):
        """Scans all registered nodes and marks timed-out instances as DISCONNECTED."""
        now_ts = time.time()
        for node in list(self.nodes.values()):
            if node.status != NodeStatus.DISCONNECTED:
                elapsed = now_ts - node.last_seen
                if elapsed > self.timeout_seconds:
                    logger.warning(
                        f"Watchdog timeout triggered for node '{node.rental_id}' "
                        f"({elapsed:.1f}s > {self.timeout_seconds}s limit). Marking DISCONNECTED."
                    )
                    await self._transition_state(node, NodeStatus.DISCONNECTED)

    def get_node_status(self, rental_id: str) -> Dict[str, Any]:
        """Return live metrics and connectivity info for a specific rental node."""
        node = self.nodes.get(rental_id)
        if not node:
            return {
                "rental_id": rental_id,
                "status": NodeStatus.DISCONNECTED.value,
                "is_connected": False,
                "is_live": False,
                "active_pods": 0,
                "transport": "none",
                "last_seen_sec_ago": None,
                "client_timezone": "UTC",
                "state_duration_formatted": "0s",
                "thermal": {},
            }
        return node.to_dict()

    def get_all_nodes(self) -> List[Dict[str, Any]]:
        """Return all tracked nodes in the fleet."""
        return [node.to_dict() for node in self.nodes.values()]


node_manager = NodeLifecycleManager()
