from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Header, Cookie, Request, Response, UploadFile, File, Depends, Query
from fastapi.responses import Response as FastAPIResponse
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os, uuid, jwt, bcrypt, httpx, requests, logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("productify")

ROOT_DIR = os.path.dirname(__file__)
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
JWT_SECRET = os.environ["JWT_SECRET"]
APP_NAME = os.environ.get("APP_NAME", "productify")
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
storage_key = None

EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "4814802603-c0vb27vmn19l3j3057v0qqf45mkll6rc.apps.googleusercontent.com")

app = FastAPI(title="Productify API")
api = APIRouter(prefix="/api")


# ============== STORAGE ==============
def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        r.raise_for_status()
        storage_key = r.json()["storage_key"]
        logger.info("Storage initialized")
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        raise


def put_object(path: str, data: bytes, content_type: str):
    key = init_storage()
    r = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    r.raise_for_status()
    return r.json()


def get_object(path: str):
    key = init_storage()
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


# ============== MODELS ==============
class AuthInput(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    role: str = "buyer"


class SessionInput(BaseModel):
    session_id: str


class GoogleAuthInput(BaseModel):
    credential: str


class ProductInput(BaseModel):
    title: str
    category: str
    description: str
    price: float
    image: str
    tags: Optional[List[str]] = []


class RentalInput(BaseModel):
    title: str
    gpu: str
    vram: str
    price: float
    location: str
    image: str
    description: Optional[str] = ""
    specs: Optional[dict] = {}


class CartItemInput(BaseModel):
    id: str
    kind: str  # product | rental
    quantity: int = 1


class CheckoutInput(BaseModel):
    items: List[CartItemInput]
    provider: str  # stripe | razorpay | paypal
    origin_url: str
    region: Optional[str] = "US"


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


class ConsentInput(BaseModel):
    consent_type: str  # cookies | terms | privacy | refunds | acceptable_use | marketing
    choice: str        # accepted | rejected | necessary_only | dismissed | withdrawn
    version: Optional[str] = "2026-02-20"
    anon_id: Optional[str] = None
    metadata: Optional[dict] = {}


class ReportInput(BaseModel):
    listing_id: str
    listing_kind: str  # product | rental
    reason: str        # illegal | infringing | malware | scam | csam | other
    details: Optional[str] = ""
    reporter_email: Optional[str] = None


class ReportResolveInput(BaseModel):
    decision: str  # dismiss | remove_listing
    notes: Optional[str] = ""


class PolicyVersionsInput(BaseModel):
    versions: dict  # {"terms": "2026-03-01", ...}


def public_user(u):
    return {
        "id": u.get("id"),
        "email": u["email"],
        "name": u.get("name", "Member"),
        "role": u.get("role", "buyer"),
        "avatar_url": u.get("avatar_url"),
        "phone": u.get("phone"),
        "phone_verified": u.get("phone_verified", False),
    }


def jwt_token(u):
    return jwt.encode({"sub": u["id"], "exp": datetime.now(timezone.utc) + timedelta(days=7)}, JWT_SECRET, algorithm="HS256")


async def current_user(request: Request):
    # 1) session_token cookie (Emergent Google Auth)
    session_token = request.cookies.get("session_token")
    if session_token:
        sess = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if sess:
            exp = sess.get("expires_at")
            if isinstance(exp, str):
                try:
                    exp = datetime.fromisoformat(exp)
                except Exception:
                    exp = None
            if exp and exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp and exp >= datetime.now(timezone.utc):
                u = await db.users.find_one({"id": sess["user_id"]}, {"_id": 0})
                if u:
                    return u
    # 2) Bearer JWT (email/password path)
    authz = request.headers.get("authorization")
    if authz and authz.lower().startswith("bearer "):
        token = authz[7:]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            u = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
            if u:
                return u
        except jwt.PyJWTError:
            pass
        # Fallback: treat as session_token in header (testing agent pattern)
        sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if sess:
            u = await db.users.find_one({"id": sess["user_id"]}, {"_id": 0})
            if u:
                return u
    raise HTTPException(401, "Please sign in to continue")


def set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key="session_token",
        value=token,
        max_age=7 * 24 * 60 * 60,
        path="/",
        httponly=True,
        secure=True,
        samesite="none",
    )


# ============== AUTH ==============
@api.get("/")
async def root():
    return {"message": "Productify API ready"}


@api.post("/auth/register")
async def register(data: AuthInput, request: Request):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "An account with this email already exists")
    role = data.role if data.role in ["buyer", "seller"] else "buyer"
    u = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": data.name or email.split("@")[0].title(),
        "role": role,
        "password_hash": bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(u)
    # Registration implies acceptance of all currently-published policies.
    for ct in POLICY_TYPES:
        try:
            await _log_consent(user=u, data=ConsentInput(consent_type=ct, choice="accepted", metadata={"source": "register"}), request=request)
        except Exception:
            pass
    return {"user": public_user(u), "token": jwt_token(u)}


@api.post("/auth/login")
async def login(data: AuthInput):
    u = await db.users.find_one({"email": data.email.lower().strip()})
    if not u or "password_hash" not in u or not bcrypt.checkpw(data.password.encode(), u["password_hash"].encode()):
        raise HTTPException(401, "Email or password is incorrect")
    return {"user": public_user(u), "token": jwt_token(u)}


@api.post("/auth/session")
async def create_session(data: SessionInput, response: Response, request: Request):
    """Exchange Emergent session_id for our session token, set httpOnly cookie."""
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": data.session_id})
        if r.status_code != 200:
            raise HTTPException(401, "Google sign-in failed")
        info = r.json()
    email = (info.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(400, "Google account did not return an email")
    u = await db.users.find_one({"email": email})
    is_new = False
    if not u:
        is_new = True
        u = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": info.get("name") or email.split("@")[0].title(),
            "avatar_url": info.get("picture"),
            "role": "buyer",
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(u)
    else:
        updates = {}
        if info.get("picture") and not u.get("avatar_url"):
            updates["avatar_url"] = info["picture"]
        if updates:
            await db.users.update_one({"id": u["id"]}, {"$set": updates})
            u.update(updates)
    session_token = info.get("session_token") or uuid.uuid4().hex
    await db.user_sessions.insert_one({
        "user_id": u["id"],
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    set_session_cookie(response, session_token)
    if is_new:
        for ct in POLICY_TYPES:
            try:
                await _log_consent(user=u, data=ConsentInput(consent_type=ct, choice="accepted", metadata={"source": "google_signup"}), request=request)
            except Exception:
                pass
    return {"user": public_user(u)}


@api.post("/auth/google")
async def google_auth(data: GoogleAuthInput, response: Response, request: Request):
    """Direct Google Sign-In verification via Google's tokeninfo API."""
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(f"{GOOGLE_TOKENINFO_URL}?id_token={data.credential}")
        if r.status_code != 200:
            raise HTTPException(401, "Google verification failed")
        info = r.json()
    email = (info.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(400, "Google account did not return an email")
    u = await db.users.find_one({"email": email})
    is_new = False
    if not u:
        is_new = True
        u = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": info.get("name") or email.split("@")[0].title(),
            "avatar_url": info.get("picture"),
            "role": "buyer",
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(u)
    else:
        updates = {}
        if info.get("picture") and not u.get("avatar_url"):
            updates["avatar_url"] = info["picture"]
        if updates:
            await db.users.update_one({"id": u["id"]}, {"$set": updates})
            u.update(updates)
    session_token = uuid.uuid4().hex
    await db.user_sessions.insert_one({
        "user_id": u["id"],
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    set_session_cookie(response, session_token)
    if is_new:
        for ct in POLICY_TYPES:
            try:
                await _log_consent(user=u, data=ConsentInput(consent_type=ct, choice="accepted", metadata={"source": "google_signup"}), request=request)
            except Exception:
                pass
    token = jwt_token(u)
    return {"user": public_user(u), "token": token}


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return public_user(user)


@api.patch("/auth/me")
async def update_me(data: ProfileUpdate, user=Depends(current_user)):
    updates = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
        user.update(updates)
    return public_user(user)


# ============== PRODUCTS & RENTALS ==============
@api.get("/products")
async def products(q: str = "", category: str = "all", sort: str = "recent", min_price: float = 0, max_price: float = 100000):
    query = {"approved": True, "price": {"$gte": min_price, "$lte": max_price}}
    if category != "all":
        query["category"] = category
    rows = await db.products.find(query, {"_id": 0}).to_list(200)
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in (r.get("title", "") + " " + r.get("description", "") + " " + " ".join(r.get("tags", []))).lower()]
    if sort == "price_asc":
        rows.sort(key=lambda x: x["price"])
    elif sort == "price_desc":
        rows.sort(key=lambda x: -x["price"])
    return rows


@api.get("/products/{pid}")
async def product_detail(pid: str):
    r = await db.products.find_one({"id": pid}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Product not found")
    return r


@api.post("/products")
async def create_product(data: ProductInput, user=Depends(current_user)):
    if user.get("role") not in ["seller", "admin"]:
        raise HTTPException(403, "Seller access required")
    item = data.model_dump() | {
        "id": str(uuid.uuid4()),
        "approved": user.get("role") == "admin",
        "seller": user["name"],
        "seller_id": user["id"],
        "type": "digital",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.products.insert_one(item)
    return {k: v for k, v in item.items() if k != "_id"}


@api.get("/rentals")
async def rentals(q: str = "", sort: str = "recent"):
    rows = await db.rentals.find({"status": "approved"}, {"_id": 0}).to_list(200)
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in (r.get("title", "") + " " + r.get("gpu", "") + " " + r.get("description", "")).lower()]
    if sort == "price_asc":
        rows.sort(key=lambda x: x["price"])
    elif sort == "price_desc":
        rows.sort(key=lambda x: -x["price"])
    return rows


@api.get("/rentals/{rid}")
async def rental_detail(rid: str):
    r = await db.rentals.find_one({"id": rid}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Rental not found")
    return r


@api.post("/rentals")
async def create_rental(data: RentalInput, user=Depends(current_user)):
    if user.get("role") not in ["seller", "admin"]:
        raise HTTPException(403, "Seller access required")
    item = data.model_dump() | {
        "id": str(uuid.uuid4()),
        "status": "approved" if user.get("role") == "admin" else "pending",
        "owner": user["name"],
        "owner_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.rentals.insert_one(item)
    return {k: v for k, v in item.items() if k != "_id"}


# ============== ADMIN ==============
@api.get("/admin/pending")
async def pending(user=Depends(current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return await db.rentals.find({"status": "pending"}, {"_id": 0}).to_list(100)


@api.post("/admin/rentals/{rid}/{decision}")
async def decide(rid: str, decision: str, user=Depends(current_user)):
    if user.get("role") != "admin" or decision not in ["approved", "rejected"]:
        raise HTTPException(403, "Admin access required")
    await db.rentals.update_one({"id": rid}, {"$set": {"status": decision}})
    return {"ok": True}


# ============== UPLOADS ==============
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_UPLOAD = 10 * 1024 * 1024  # 10 MB


@api.post("/uploads")
async def upload(file: UploadFile = File(...), user=Depends(current_user)):
    ct = file.content_type or "application/octet-stream"
    if ct not in ALLOWED_MIME:
        raise HTTPException(400, "Only JPG, PNG, WEBP, GIF images are supported")
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "File exceeds 10 MB limit")
    ext = (file.filename or "img").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4().hex}.{ext}"
    result = put_object(path, data, ct)
    doc = {
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": ct,
        "size": result.get("size", len(data)),
        "user_id": user["id"],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.files.insert_one(doc)
    frontend = os.environ.get("FRONTEND_URL", "").rstrip("/")
    return {"path": result["path"], "url": f"/api/files/{result['path']}", "id": doc["id"]}


@api.get("/files/{path:path}")
async def download_file(path: str, auth: Optional[str] = Query(None)):
    # Public read for listing/avatar display; DB is source of truth
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(404, "File not found")
    data, ct = get_object(path)
    return FastAPIResponse(content=data, media_type=record.get("content_type", ct))


# ============== ORDERS & PAYMENTS ==============
@api.post("/payments/checkout")
async def create_checkout(data: CheckoutInput, user=Depends(current_user)):
    # Server-computed totals
    subtotal = 0.0
    resolved_items = []
    for it in data.items:
        if it.kind == "product":
            src = await db.products.find_one({"id": it.id, "approved": True}, {"_id": 0})
        else:
            src = await db.rentals.find_one({"id": it.id, "status": "approved"}, {"_id": 0})
        if not src:
            raise HTTPException(400, f"Item not available: {it.id}")
        qty = max(1, min(50, int(it.quantity or 1)))
        line_total = float(src["price"]) * qty
        subtotal += line_total
        resolved_items.append({
            "id": src["id"], "kind": it.kind, "title": src["title"],
            "price": src["price"], "quantity": qty, "image": src.get("image"),
        })
    if subtotal <= 0:
        raise HTTPException(400, "Cart is empty")
    tax = round(subtotal * 0.05, 2)
    total = round(subtotal + tax, 2)

    provider = data.provider if data.provider in ["stripe", "razorpay", "paypal"] else "stripe"
    session_id = f"px_{uuid.uuid4().hex}"
    tx = {
        "session_id": session_id,
        "user_id": user["id"],
        "items": resolved_items,
        "subtotal": subtotal,
        "tax": tax,
        "amount": total,
        "currency": "USD" if provider != "razorpay" else "INR",
        "provider": provider,
        "region": data.region,
        "status": "initiated",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "mocked": True,
    }
    await db.payment_transactions.insert_one(tx)
    # Mocked provider — return an internal URL to our own success handler
    checkout_url = f"{data.origin_url}/payment/processing?session_id={session_id}&provider={provider}"
    return {"checkout_url": checkout_url, "session_id": session_id, "provider": provider, "amount": total, "currency": tx["currency"], "mocked": True}


@api.post("/payments/confirm/{session_id}")
async def confirm_payment(session_id: str, user=Depends(current_user)):
    """Mock confirmation — flips a pending tx to paid and creates an order."""
    tx = await db.payment_transactions.find_one({"session_id": session_id, "user_id": user["id"]}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Transaction not found")
    if tx.get("payment_status") != "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id, "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        order = {
            "id": "PX-" + uuid.uuid4().hex[:8].upper(),
            "user_id": user["id"],
            "items": tx["items"],
            "total": tx["amount"],
            "currency": tx["currency"],
            "provider": tx["provider"],
            "session_id": session_id,
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.orders.insert_one(order)
    return {"ok": True}


@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Transaction not found")
    return {"session_id": session_id, "status": tx.get("status"), "payment_status": tx.get("payment_status"), "amount": tx.get("amount"), "currency": tx.get("currency"), "provider": tx.get("provider")}


@api.get("/orders")
async def orders(user=Depends(current_user)):
    return await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)


@api.get("/orders/{oid}")
async def order_detail(oid: str, user=Depends(current_user)):
    o = await db.orders.find_one({"id": oid, "user_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    return o


# ============== CONSENT LOGGING ==============
ALLOWED_CONSENT_TYPES = {"cookies", "terms", "privacy", "refunds", "acceptable_use", "marketing"}
ALLOWED_CONSENT_CHOICES = {"accepted", "rejected", "necessary_only", "dismissed", "withdrawn"}


async def _log_consent(*, user, data: "ConsentInput", request: Request):
    if data.consent_type not in ALLOWED_CONSENT_TYPES:
        raise HTTPException(400, "Unknown consent_type")
    if data.choice not in ALLOWED_CONSENT_CHOICES:
        raise HTTPException(400, "Unknown choice")
    fwd = request.headers.get("x-forwarded-for", "")
    ip = fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else None)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"] if user else None,
        "email": user.get("email") if user else None,
        "anon_id": data.anon_id if not user else None,
        "consent_type": data.consent_type,
        "choice": data.choice,
        "version": data.version,
        "ip": ip,
        "user_agent": request.headers.get("user-agent"),
        "metadata": data.metadata or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.consents.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.post("/consents")
async def log_consent(data: ConsentInput, request: Request):
    """Public endpoint — logs consent for signed-in users OR anonymous visitors (via anon_id)."""
    user = None
    try:
        user = await current_user(request)
    except HTTPException:
        pass
    if not user and not data.anon_id:
        raise HTTPException(400, "anon_id required when not signed in")
    return await _log_consent(user=user, data=data, request=request)


@api.get("/consents/me")
async def my_consents(user=Depends(current_user)):
    return await db.consents.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.get("/admin/consents")
async def admin_consents(user=Depends(current_user), q: str = "", limit: int = 200):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    query = {}
    if q:
        query = {"$or": [{"email": {"$regex": q, "$options": "i"}}, {"user_id": q}, {"anon_id": q}]}
    return await db.consents.find(query, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(1000, limit)))


# ============== POLICY VERSIONS & BUMP PROMPT ==============
POLICY_TYPES = ("terms", "privacy", "refunds", "acceptable_use", "cookies")


async def get_current_versions():
    doc = await db.policy_versions.find_one({"id": "current"}, {"_id": 0})
    return (doc or {}).get("versions", {})


@api.get("/policies/versions")
async def policies_versions():
    return await get_current_versions()


@api.post("/admin/policies/versions")
async def admin_set_versions(data: PolicyVersionsInput, user=Depends(current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    versions = {k: str(v) for k, v in data.versions.items() if k in POLICY_TYPES}
    if not versions:
        raise HTTPException(400, "No valid policy versions provided")
    current = await get_current_versions()
    current.update(versions)
    await db.policy_versions.update_one(
        {"id": "current"},
        {"$set": {"id": "current", "versions": current, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"versions": current}


@api.get("/consents/status")
async def consent_status(user=Depends(current_user)):
    """Returns list of policies the user must re-accept based on the latest published versions."""
    current = await get_current_versions()
    pending = []
    for ct, ver in current.items():
        latest = await db.consents.find_one(
            {"user_id": user["id"], "consent_type": ct, "choice": "accepted"},
            {"_id": 0}, sort=[("created_at", -1)],
        )
        accepted_version = latest.get("version") if latest else None
        if accepted_version != ver:
            pending.append({"consent_type": ct, "current_version": ver, "accepted_version": accepted_version})
    return {"pending": pending, "current_versions": current}


# ============== ABUSE REPORTS ==============
ALLOWED_REPORT_REASONS = {"illegal", "infringing", "malware", "scam", "csam", "other"}
ALLOWED_REPORT_STATUS = {"open", "dismissed", "removed"}


@api.post("/reports")
async def file_report(data: ReportInput, request: Request):
    if data.listing_kind not in ("product", "rental"):
        raise HTTPException(400, "Invalid listing_kind")
    if data.reason not in ALLOWED_REPORT_REASONS:
        raise HTTPException(400, "Invalid reason")
    coll = db.products if data.listing_kind == "product" else db.rentals
    listing = await coll.find_one({"id": data.listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(404, "Listing not found")
    # Try to attribute to signed-in user (optional)
    reporter = None
    try:
        reporter = await current_user(request)
    except HTTPException:
        pass
    fwd = request.headers.get("x-forwarded-for", "")
    ip = fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else None)
    doc = {
        "id": str(uuid.uuid4()),
        "listing_id": data.listing_id,
        "listing_kind": data.listing_kind,
        "listing_title": listing.get("title"),
        "reason": data.reason,
        "details": (data.details or "")[:2000],
        "reporter_id": reporter["id"] if reporter else None,
        "reporter_email": reporter.get("email") if reporter else (data.reporter_email or None),
        "ip": ip,
        "user_agent": request.headers.get("user-agent"),
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.abuse_reports.insert_one(doc)
    # Do NOT auto-hide the listing — only mark it as under review, increment counter, and let admin decide.
    await coll.update_one(
        {"id": data.listing_id},
        {"$set": {"under_review": True, "last_reported_at": doc["created_at"]},
         "$inc": {"reports_count": 1}},
    )
    return {"id": doc["id"], "status": doc["status"]}


@api.get("/admin/reports")
async def admin_reports(user=Depends(current_user), status: str = "open", limit: int = 200):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    if status not in ALLOWED_REPORT_STATUS and status != "all":
        raise HTTPException(400, "Invalid status")
    query = {} if status == "all" else {"status": status}
    return await db.abuse_reports.find(query, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(1000, limit)))


@api.post("/admin/reports/{report_id}/resolve")
async def resolve_report(report_id: str, data: ReportResolveInput, user=Depends(current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    if data.decision not in ("dismiss", "remove_listing"):
        raise HTTPException(400, "Invalid decision")
    report = await db.abuse_reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(404, "Report not found")
    new_status = "dismissed" if data.decision == "dismiss" else "removed"
    await db.abuse_reports.update_one(
        {"id": report_id},
        {"$set": {"status": new_status, "review_notes": data.notes, "admin_id": user["id"], "resolved_at": datetime.now(timezone.utc).isoformat()}},
    )
    coll = db.products if report["listing_kind"] == "product" else db.rentals
    if data.decision == "remove_listing":
        # Take down the listing (products.approved -> False, rentals.status -> rejected)
        update = {"under_review": False, "removed_by_admin": True, "removed_reason": report["reason"]}
        if report["listing_kind"] == "product":
            update["approved"] = False
        else:
            update["status"] = "rejected"
        await coll.update_one({"id": report["listing_id"]}, {"$set": update})
    else:
        # Dismiss — clear under_review only if no other open reports remain
        remaining = await db.abuse_reports.count_documents({"listing_id": report["listing_id"], "status": "open"})
        if remaining == 0:
            await coll.update_one({"id": report["listing_id"]}, {"$set": {"under_review": False}})
    return {"status": new_status, "decision": data.decision}


@api.get("/seller/reports")
async def seller_report_history(user=Depends(current_user)):
    """Report history + counts on the current seller's listings, so they can self-correct."""
    if user.get("role") not in ("seller", "admin"):
        raise HTTPException(403, "Seller access required")
    uid = user["id"]
    # Fetch this seller's listings (products via seller_id, rentals via owner_id)
    products = await db.products.find({"seller_id": uid}, {"_id": 0}).to_list(500)
    rentals = await db.rentals.find({"owner_id": uid}, {"_id": 0}).to_list(500)
    ids = [p["id"] for p in products] + [r["id"] for r in rentals]
    if not ids:
        return {"listings": [], "totals": {"open": 0, "dismissed": 0, "removed": 0, "total": 0}}
    reports = await db.abuse_reports.find({"listing_id": {"$in": ids}}, {"_id": 0, "ip": 0, "user_agent": 0, "reporter_id": 0, "reporter_email": 0}).sort("created_at", -1).to_list(2000)
    by_listing = {}
    totals = {"open": 0, "dismissed": 0, "removed": 0, "total": 0}
    for r in reports:
        totals["total"] += 1
        totals[r.get("status", "open")] = totals.get(r.get("status", "open"), 0) + 1
        entry = by_listing.setdefault(r["listing_id"], {"reasons": {}, "recent": [], "open": 0, "resolved": 0})
        entry["reasons"][r["reason"]] = entry["reasons"].get(r["reason"], 0) + 1
        if r.get("status") == "open":
            entry["open"] += 1
        else:
            entry["resolved"] += 1
        if len(entry["recent"]) < 5:
            entry["recent"].append({"reason": r["reason"], "status": r.get("status"), "details": r.get("details"), "created_at": r.get("created_at")})
    listings_out = []
    for src, kind in ((products, "product"), (rentals, "rental")):
        for l in src:
            agg = by_listing.get(l["id"])
            if not agg and (l.get("reports_count", 0) or 0) == 0:
                continue  # skip clean listings for a focused view
            listings_out.append({
                "listing_id": l["id"],
                "listing_kind": kind,
                "title": l.get("title"),
                "image": l.get("image"),
                "price": l.get("price"),
                "status": l.get("status") if kind == "rental" else ("approved" if l.get("approved") else "unapproved"),
                "under_review": bool(l.get("under_review")),
                "removed_by_admin": bool(l.get("removed_by_admin")),
                "reports_count": l.get("reports_count", 0),
                "reasons": agg["reasons"] if agg else {},
                "open": agg["open"] if agg else 0,
                "resolved": agg["resolved"] if agg else 0,
                "recent": agg["recent"] if agg else [],
            })
    # Order most-reported first
    listings_out.sort(key=lambda x: (-x["open"], -x["reports_count"]))
    return {"listings": listings_out, "totals": totals}


# ============== RENTAL WORKSPACE (file transfer for GPU service) ==============
class WorkspaceFileInput(BaseModel):
    rental_id: str
    file_id: str
    note: Optional[str] = ""


@api.post("/rentals/{rid}/workspace/files")
async def add_workspace_file(rid: str, data: WorkspaceFileInput, user=Depends(current_user)):
    rental = await db.rentals.find_one({"id": rid}, {"_id": 0})
    if not rental:
        raise HTTPException(404, "Rental not found")
    file_ref = await db.files.find_one({"id": data.file_id, "user_id": user["id"]}, {"_id": 0})
    if not file_ref:
        raise HTTPException(400, "File not found")
    entry = {
        "id": str(uuid.uuid4()),
        "rental_id": rid,
        "user_id": user["id"],
        "storage_path": file_ref["storage_path"],
        "url": f"/api/files/{file_ref['storage_path']}",
        "filename": file_ref.get("original_filename"),
        "size": file_ref.get("size"),
        "note": data.note,
        "direction": "upload",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.workspace_files.insert_one(entry)
    return {k: v for k, v in entry.items() if k != "_id"}


@api.get("/rentals/{rid}/workspace/files")
async def list_workspace_files(rid: str, user=Depends(current_user)):
    return await db.workspace_files.find({"rental_id": rid, "user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


# ============== SEED ==============
async def seed():
    admin_email, admin_password = os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"]
    existing_admin = await db.users.find_one({"email": admin_email})
    if not existing_admin:
        await db.users.insert_one({
            "id": "admin-productify",
            "email": admin_email,
            "name": "Productify Admin",
            "role": "admin",
            "password_hash": bcrypt.hashpw(admin_password.encode(), bcrypt.gensalt()).decode(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    # Seed current policy versions if missing
    if not await db.policy_versions.find_one({"id": "current"}):
        await db.policy_versions.insert_one({
            "id": "current",
            "versions": {"terms": "2026-02-20", "privacy": "2026-02-20", "refunds": "2026-02-20", "acceptable_use": "2026-02-20", "cookies": "2026-02-20"},
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    if await db.products.count_documents({}) == 0:
        await db.products.insert_many([
            {"id":"p1","title":"Figma Pro UI Kit","category":"Design","description":"A polished component library for product teams with 500+ components, dark and light themes, auto-layout tokens.","price":29,"tags":["figma","ui-kit","design-system"],"image":"https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=900&auto=format&fit=crop","seller":"Northstar Studio","seller_id":"seed-northstar","type":"digital","approved":True,"created_at":datetime.now(timezone.utc).isoformat()},
            {"id":"p2","title":"LaunchPad Analytics","category":"Software","description":"Understand your product metrics in one clear workspace. Real-time dashboards, cohort analysis, funnel visualization.","price":49,"tags":["analytics","dashboards","saas"],"image":"https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=900&auto=format&fit=crop","seller":"Metric Labs","seller_id":"seed-metric","type":"digital","approved":True,"created_at":datetime.now(timezone.utc).isoformat()},
            {"id":"p3","title":"Creator Video Presets","category":"Creative","description":"Cinematic color presets for your next story. 40 LUTs for DaVinci, Premiere and Final Cut.","price":18,"tags":["video","luts","presets"],"image":"https://images.unsplash.com/photo-1492724441997-5dc865305da7?q=80&w=900&auto=format&fit=crop","seller":"Framehouse","seller_id":"seed-frame","type":"digital","approved":True,"created_at":datetime.now(timezone.utc).isoformat()},
            {"id":"p4","title":"DevOps Command Center","category":"Development","description":"Ship with confidence using battle-tested dashboards. Prometheus, Grafana, Loki templates.","price":79,"tags":["devops","monitoring","grafana"],"image":"https://images.unsplash.com/photo-1461749280684-dccba630e2f6?q=80&w=900&auto=format&fit=crop","seller":"Stacksmith","seller_id":"seed-stack","type":"digital","approved":True,"created_at":datetime.now(timezone.utc).isoformat()},
            {"id":"p5","title":"Notion Startup OS","category":"Software","description":"A complete Notion workspace for early-stage teams — OKRs, hiring, roadmap, sprint boards.","price":39,"tags":["notion","templates","startup"],"image":"https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=900&auto=format&fit=crop","seller":"Northstar Studio","seller_id":"seed-northstar","type":"digital","approved":True,"created_at":datetime.now(timezone.utc).isoformat()},
            {"id":"p6","title":"3D Icon Library","category":"Design","description":"180 hand-crafted 3D icons in Blender + PNG + SVG. Perfect for landing pages and pitches.","price":24,"tags":["3d","icons","blender"],"image":"https://images.unsplash.com/photo-1618788372246-79faff0c3742?q=80&w=900&auto=format&fit=crop","seller":"Framehouse","seller_id":"seed-frame","type":"digital","approved":True,"created_at":datetime.now(timezone.utc).isoformat()},
        ])
    if await db.rentals.count_documents({}) == 0:
        await db.rentals.insert_many([
            {"id":"r1","title":"RTX 4090 Creator Node","gpu":"RTX 4090","vram":"24 GB","price":0.62,"location":"Frankfurt, DE","description":"High-throughput node for Stable Diffusion, ComfyUI, Blender Cycles rendering. NVMe scratch drive + 128 GB RAM.","specs":{"cpu":"AMD 7950X","ram":"128 GB","storage":"2 TB NVMe","bandwidth":"1 Gbps"},"image":"https://images.unsplash.com/photo-1591488320449-011701bb6704?q=80&w=900&auto=format&fit=crop","status":"approved","owner":"Cloudline","owner_id":"seed-cloudline","created_at":datetime.now(timezone.utc).isoformat()},
            {"id":"r2","title":"A100 Training Rig","gpu":"NVIDIA A100","vram":"80 GB","price":2.40,"location":"Ashburn, US","description":"Enterprise-grade LLM fine-tuning and diffusion training. Reserved slots available for multi-hour workloads.","specs":{"cpu":"AMD EPYC 7513","ram":"512 GB","storage":"4 TB NVMe RAID","bandwidth":"10 Gbps"},"image":"https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=900&auto=format&fit=crop","status":"approved","owner":"Tensor Yard","owner_id":"seed-tensor","created_at":datetime.now(timezone.utc).isoformat()},
            {"id":"r3","title":"RTX 3090 Studio","gpu":"RTX 3090","vram":"24 GB","price":0.38,"location":"Bengaluru, IN","description":"Great for solo creators — Unreal Engine, DaVinci Resolve, Substance renders at a friendly price.","specs":{"cpu":"Intel 13700K","ram":"64 GB","storage":"1 TB NVMe","bandwidth":"500 Mbps"},"image":"https://images.unsplash.com/photo-1587202372775-e229f172b9d7?q=80&w=900&auto=format&fit=crop","status":"approved","owner":"Silicon Loft","owner_id":"seed-silicon","created_at":datetime.now(timezone.utc).isoformat()},
        ])

app.include_router(api)
DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://productify-two.vercel.app",
    "https://productifynow.com",
    "https://www.productifynow.com",
]
env_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
all_origins = list(dict.fromkeys(DEFAULT_ORIGINS + env_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=all_origins,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        init_storage()
    except Exception as e:
        logger.warning(f"Storage will retry on first upload: {e}")
    await seed()


@app.on_event("shutdown")
async def shutdown():
    client.close()
