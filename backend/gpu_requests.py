"""Advance GPU requests (decided 2026-11-28).

Productify has limited GPU supply: we rent machines from a partner and lend them to renters.
So renters request a GPU at least 12 hours ahead, our team arranges it, the renter is notified,
pays (test mode during the beta) and then gets the access details.

Prices (INR, decided 2026-11-28):
  - Booked at least 12 hours ahead: Rs 70/hour, at least 4 hours.
  - Short notice (start from 1 hour ahead, less than 12): Rs 100/hour, at least 1 hour.
If we can't arrange the requested time, staff offer
another start time, which the renter accepts or declines.

Statuses:
  requested  -> new, waiting for staff
  arranging  -> staff are sourcing the machine
  new_time   -> staff offered another start time; renter accepts (-> arranging) or declines (-> cancelled)
  ready      -> machine arranged; renter must pay
  paid       -> paid; staff give access details
  active     -> access details shared
  completed  -> booking finished
  cancelled  -> cancelled by renter or staff
"""
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import emailer

CURRENCY = "INR"
HOURLY_RATE = 70          # per hour, booked LEAD_HOURS or more ahead
URGENT_RATE = 100         # per hour, short notice (URGENT_LEAD_HOURS to LEAD_HOURS ahead)
MIN_HOURS = 4             # minimum for advance bookings
URGENT_MIN_HOURS = 1      # minimum for short-notice bookings
URGENT_LEAD_HOURS = 1
MAX_HOURS = 72
LEAD_HOURS = 12
NOTIFY_CHANNELS = {"email", "site", "whatsapp", "sms"}
# [TODO: confirm the GPU models our partner can supply]
GPU_OPTIONS = ["RTX 3090", "RTX 4090", "RTX A6000", "A100 40GB", "A100 80GB", "L4", "T4", "Any available GPU"]
PHONE_RE = re.compile(r"^\+?[0-9 ()-]{8,20}$")

OPEN = {"requested", "arranging", "new_time", "ready", "paid", "active"}
RENTER_CANCELLABLE = {"requested", "arranging", "new_time", "ready"}
STAFF_MOVES = {
    "requested": {"arranging", "new_time", "ready", "cancelled"},
    "arranging": {"new_time", "ready", "cancelled"},
    "new_time": {"arranging", "ready", "cancelled"},
    "ready": {"new_time", "cancelled"},
    "paid": {"active", "cancelled"},
    "active": {"completed"},
}
LABEL = {
    "requested": "Requested", "arranging": "Arranging your GPU", "new_time": "New time offered",
    "ready": "Ready, waiting for payment", "paid": "Paid, access coming soon", "active": "Active",
    "completed": "Completed", "cancelled": "Cancelled",
}


def quote(start: datetime, hours: int) -> dict:
    """Price a booking from how far ahead it starts. Raises 422 with a clear reason."""
    lead = start - datetime.now(timezone.utc)
    if lead < timedelta(hours=URGENT_LEAD_HOURS):
        raise HTTPException(422, f"Please choose a start time at least {URGENT_LEAD_HOURS} hour from now.")
    urgent = lead < timedelta(hours=LEAD_HOURS)
    rate, min_h = (URGENT_RATE, URGENT_MIN_HOURS) if urgent else (HOURLY_RATE, MIN_HOURS)
    if hours < min_h:
        raise HTTPException(422, f"Bookings made {LEAD_HOURS}+ hours ahead are at least {MIN_HOURS} hours.")
    if hours > MAX_HOURS:
        raise HTTPException(422, f"Book at most {MAX_HOURS} hours in one request.")
    return {"urgent": urgent, "rate": rate, "price": rate * hours}


def parse_when(s: str) -> datetime:
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(422, "Please choose a valid start date and time.")
    if d.tzinfo is None:
        raise HTTPException(422, "Start time must include a time zone.")
    return d.astimezone(timezone.utc)


class GpuRequestInput(BaseModel):
    gpu: str
    start_at: str
    hours: int
    notify: List[str] = ["email", "site"]
    phone: Optional[str] = ""
    notes: Optional[str] = ""


class StaffUpdateInput(BaseModel):
    status: str
    offered_start: Optional[str] = None
    access: Optional[str] = None
    note: Optional[str] = None


def build_router(db, current_user, require_staff) -> APIRouter:
    r = APIRouter()

    def public(doc: dict, staff: bool = False) -> dict:
        out = {k: v for k, v in doc.items() if k != "_id"}
        out["status_label"] = LABEL.get(out.get("status"), out.get("status"))
        if not staff and out.get("status") not in {"active", "completed"}:
            out.pop("access", None)  # access details only after payment and hand-over
        out.pop("events", None) if not staff else None
        return out

    async def notify(doc: dict, subject: str, text: str):
        """Tell the renter through the channels they chose. Email is sent now; WhatsApp/SMS are
        queued for staff to send by hand until a messaging provider is connected."""
        await db().gpu_requests.update_one({"id": doc["id"]}, {"$set": {"unread": True}})
        if "email" in doc.get("notify", []) and doc.get("email"):
            await emailer.gpu_request_update(doc["email"], doc.get("name", ""), subject, text)
        manual = [c for c in doc.get("notify", []) if c in {"whatsapp", "sms"}]
        if manual:
            # [TODO: connect a WhatsApp/SMS provider; until then staff message the renter by hand]
            await db().gpu_requests.update_one({"id": doc["id"]}, {"$push": {"manual_messages": {
                "channels": manual, "phone": doc.get("phone", ""), "text": text,
                "at": datetime.now(timezone.utc).isoformat(), "sent": False}}})

    async def get_own(rid: str, user: dict) -> dict:
        doc = await db().gpu_requests.find_one({"id": rid, "user_id": user["id"]})
        if not doc:
            raise HTTPException(404, "Request not found.")
        return doc

    async def log(rid: str, by: str, what: str, extra: Optional[dict] = None):
        await db().gpu_requests.update_one({"id": rid}, {"$push": {"events": {
            "at": datetime.now(timezone.utc).isoformat(), "by": by, "what": what, **(extra or {})}}})

    @r.get("/gpu-requests/options")
    async def options():
        return {"currency": CURRENCY, "hourly_rate": HOURLY_RATE, "urgent_rate": URGENT_RATE,
                "min_hours": MIN_HOURS, "urgent_min_hours": URGENT_MIN_HOURS, "max_hours": MAX_HOURS,
                "lead_hours": LEAD_HOURS, "urgent_lead_hours": URGENT_LEAD_HOURS,
                "gpus": GPU_OPTIONS, "channels": sorted(NOTIFY_CHANNELS)}

    @r.post("/gpu-requests")
    async def create(body: GpuRequestInput, user=Depends(current_user)):
        if body.gpu not in GPU_OPTIONS:
            raise HTTPException(422, "Please choose a GPU from the list.")
        start = parse_when(body.start_at)
        q = quote(start, body.hours)
        price = q["price"]
        notify_ch = [c for c in dict.fromkeys(body.notify) if c in NOTIFY_CHANNELS]
        if not notify_ch:
            raise HTTPException(422, "Choose at least one way for us to remind you.")
        phone = (body.phone or "").strip()
        if {"whatsapp", "sms"} & set(notify_ch) and not PHONE_RE.match(phone):
            raise HTTPException(422, "Please enter a valid phone number for WhatsApp or SMS.")
        if await db().gpu_requests.count_documents({"user_id": user["id"], "status": {"$in": list(OPEN)}}) >= 5:
            raise HTTPException(429, "You already have 5 open requests. Cancel one or wait for it to finish.")
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "id": str(uuid.uuid4()), "user_id": user["id"], "email": user.get("email", ""),
            "name": user.get("name", ""), "gpu": body.gpu, "start_at": start.isoformat(),
            "hours": body.hours, "price": price, "rate": q["rate"], "urgent": q["urgent"], "currency": CURRENCY,
            "notify": notify_ch, "phone": phone, "notes": (body.notes or "").strip()[:1000],
            "status": "requested", "offered_start": None, "access": "", "staff_note": "",
            "unread": False, "manual_messages": [], "created_at": now, "updated_at": now,
            "events": [{"at": now, "by": "renter", "what": "requested"}],
        }
        await db().gpu_requests.insert_one(doc)
        if "email" in notify_ch and doc["email"]:
            await emailer.gpu_request_update(doc["email"], doc["name"], f"We got your {body.gpu} request",
                                             f"We've received your request for a {body.gpu} for {body.hours} hour"
                                             f"{'' if body.hours == 1 else 's'}. We'll tell you when it's arranged.")
        return public(doc)

    @r.get("/gpu-requests/mine")
    async def mine(user=Depends(current_user)):
        rows = await db().gpu_requests.find({"user_id": user["id"]}).sort("created_at", -1).to_list(100)
        return [public(d) for d in rows]

    @r.post("/gpu-requests/mine/seen")
    async def seen(user=Depends(current_user)):
        await db().gpu_requests.update_many({"user_id": user["id"], "unread": True}, {"$set": {"unread": False}})
        return {"ok": True}

    @r.post("/gpu-requests/{rid}/cancel")
    async def cancel(rid: str, user=Depends(current_user)):
        doc = await get_own(rid, user)
        if doc["status"] not in RENTER_CANCELLABLE:
            raise HTTPException(409, "This request can't be cancelled now. Contact support@productifynow.com.")
        await db().gpu_requests.update_one({"id": rid}, {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}})
        await log(rid, "renter", "cancelled")
        return public(await db().gpu_requests.find_one({"id": rid}))

    @r.post("/gpu-requests/{rid}/accept-time")
    async def accept_time(rid: str, user=Depends(current_user)):
        doc = await get_own(rid, user)
        if doc["status"] != "new_time" or not doc.get("offered_start"):
            raise HTTPException(409, "There's no new time to accept.")
        await db().gpu_requests.update_one({"id": rid}, {"$set": {
            "status": "arranging", "start_at": doc["offered_start"], "offered_start": None,
            "updated_at": datetime.now(timezone.utc).isoformat()}})
        await log(rid, "renter", "accepted new time")
        return public(await db().gpu_requests.find_one({"id": rid}))

    @r.post("/gpu-requests/{rid}/pay")
    async def pay(rid: str, user=Depends(current_user)):
        # Test mode during the closed beta: no real money moves (CLAUDE.md §5).
        # [TODO: connect the real checkout once payments are live]
        doc = await get_own(rid, user)
        if doc["status"] != "ready":
            raise HTTPException(409, "You can pay once your GPU is ready.")
        await db().gpu_requests.update_one({"id": rid}, {"$set": {
            "status": "paid", "paid_at": datetime.now(timezone.utc).isoformat(), "payment_mode": "test",
            "updated_at": datetime.now(timezone.utc).isoformat()}})
        await log(rid, "renter", "paid (test mode)")
        return public(await db().gpu_requests.find_one({"id": rid}))

    # ---------- staff ----------

    @r.get("/admin/gpu-requests")
    async def admin_list(status: str = "open", user=Depends(current_user)):
        require_staff(user)
        q = {"status": {"$in": list(OPEN)}} if status == "open" else ({} if status == "all" else {"status": status})
        rows = await db().gpu_requests.find(q).sort("start_at", 1).to_list(500)
        return [public(d, staff=True) for d in rows]

    @r.post("/admin/gpu-requests/{rid}")
    async def admin_update(rid: str, body: StaffUpdateInput, user=Depends(current_user)):
        require_staff(user)
        doc = await db().gpu_requests.find_one({"id": rid})
        if not doc:
            raise HTTPException(404, "Request not found.")
        new = body.status
        if new not in STAFF_MOVES.get(doc["status"], set()):
            raise HTTPException(409, f"Can't move a request from {LABEL[doc['status']]} to {LABEL.get(new, new)}.")
        now = datetime.now(timezone.utc)
        upd = {"status": new, "updated_at": now.isoformat()}
        if body.note is not None:
            upd["staff_note"] = body.note.strip()[:1000]
        when = lambda iso: datetime.fromisoformat(iso).strftime("%d %b %Y, %H:%M UTC")
        msg = None
        if new == "new_time":
            if not body.offered_start:
                raise HTTPException(422, "Choose the new start time to offer.")
            off = parse_when(body.offered_start)
            if off <= now:
                raise HTTPException(422, "The new start time must be in the future.")
            upd["offered_start"] = off.isoformat()
            msg = ("We can't get your GPU at that time", f"We couldn't arrange a {doc['gpu']} for "
                   f"{when(doc['start_at'])}. We can offer {when(off.isoformat())} instead. Open your requests to accept or cancel.")
        elif new == "ready":
            msg = ("Your GPU is ready", f"Your {doc['gpu']} for {when(doc['start_at'])} is arranged. "
                   f"Pay Rs {doc['price']} to confirm, and we'll send your access details.")
        elif new == "active":
            if not (body.access or "").strip():
                raise HTTPException(422, "Add the access details the renter needs to connect.")
            upd["access"] = body.access.strip()[:4000]
            msg = ("Your GPU access is ready", f"Your {doc['gpu']} is ready to use. Open your requests on Productify to see how to connect.")
        elif new == "cancelled":
            msg = ("Your GPU request was cancelled", f"We had to cancel your {doc['gpu']} request. "
                   + (f"Note from our team: {upd['staff_note']}" if upd.get("staff_note") else "Reply to this email if you have questions."))
        await db().gpu_requests.update_one({"id": rid}, {"$set": upd})
        await log(rid, user.get("email", "staff"), new)
        doc = await db().gpu_requests.find_one({"id": rid})
        if msg:
            await notify(doc, *msg)
            doc = await db().gpu_requests.find_one({"id": rid})
        return public(doc, staff=True)

    @r.post("/admin/gpu-requests/{rid}/messages-sent")
    async def admin_messages_sent(rid: str, user=Depends(current_user)):
        require_staff(user)
        await db().gpu_requests.update_one({"id": rid}, {"$set": {"manual_messages.$[].sent": True}})
        return public(await db().gpu_requests.find_one({"id": rid}), staff=True)

    return r
