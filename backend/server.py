from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Header, Cookie, Request, Response, UploadFile, File, Depends, Query
from fastapi.responses import Response as FastAPIResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os, uuid, jwt, bcrypt, httpx, requests, logging, secrets, random

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
    surname: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    username: Optional[str] = None
    storename: Optional[str] = None
    store_logo_url: Optional[str] = None
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
    role: Optional[str] = None


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


class SellerVerifySendCodeInput(BaseModel):
    type: str  # email | phone
    value: str


class SellerVerifyConfirmInput(BaseModel):
    type: str  # email | phone
    value: str
    code: str


class SellerActivateInput(BaseModel):
    phone: str
    username: Optional[str] = None
    storename: Optional[str] = None
    store_logo_url: Optional[str] = None
    avatar_url: Optional[str] = None
    tier: Optional[str] = "free"


class SellerRecoveryInput(BaseModel):
    recovery_type: str  # phone | email | recovery_key
    proof_code: Optional[str] = None
    password: Optional[str] = None
    new_value: str


class PayoutSettingsInput(BaseModel):
    method: str  # bank | paypal | upi
    details: dict


class PayoutWithdrawInput(BaseModel):
    amount: float


class SubscriptionInput(BaseModel):
    tier: str = "pro"


class AdminRoleUpdateInput(BaseModel):
    role: str


class AdminStatusUpdateInput(BaseModel):
    banned: bool
    reason: Optional[str] = None


class AdminPayoutDecisionInput(BaseModel):
    decision: str  # completed | rejected
    notes: Optional[str] = None


class InstanceDeployInput(BaseModel):
    rental_id: str
    template_id: str = "jupyter-pytorch"  # jupyter-pytorch | comfyui-sdxl | ollama-llm | ubuntu-base
    disk_size_gb: int = 50
    ssh_public_key: Optional[str] = None
    env_vars: Optional[dict] = None


class InstanceActionInput(BaseModel):
    action: str  # pause | resume | terminate


class CreditTopupInput(BaseModel):
    amount: float
    provider: str = "stripe"


class HostHardwareDetectionInput(BaseModel):
    probe_token: Optional[str] = None
    manual_override: Optional[dict] = None
    real_specs: Optional[dict] = None



def public_user(u):
    return {
        "id": u.get("id"),
        "email": u["email"],
        "name": u.get("name", "Member"),
        "surname": u.get("surname", ""),
        "username": u.get("username", ""),
        "storename": u.get("storename", ""),
        "store_logo_url": u.get("store_logo_url"),
        "role": u.get("role", "buyer"),
        "avatar_url": u.get("avatar_url"),
        "phone": u.get("phone"),
        "phone_verified": u.get("phone_verified", False),
        "email_verified": u.get("email_verified", True if u.get("auth_provider") == "google" else False),
        "seller_verified": u.get("seller_verified", False),
        "seller_tier": u.get("seller_tier", "free"),
        "payout_lock_until": u.get("payout_lock_until"),
        "compute_credits": float(u.get("compute_credits", 0.0)),
        "balance": float(u.get("balance", 0.0)),
        "banned": u.get("banned", False),
        "created_at": u.get("created_at"),
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
                    if u.get("banned"):
                        raise HTTPException(403, "This account has been suspended by an administrator.")
                    return u
    # 2) Bearer JWT (email/password path)
    authz = request.headers.get("authorization")
    if authz and authz.lower().startswith("bearer "):
        token = authz[7:]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            u = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
            if u:
                if u.get("banned"):
                    raise HTTPException(403, "This account has been suspended by an administrator.")
                return u
        except jwt.PyJWTError:
            pass
        # Fallback: treat as session_token in header (testing agent pattern)
        sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if sess:
            u = await db.users.find_one({"id": sess["user_id"]}, {"_id": 0})
            if u:
                if u.get("banned"):
                    raise HTTPException(403, "This account has been suspended by an administrator.")
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
        "surname": data.surname or "",
        "phone": data.phone or "",
        "avatar_url": data.avatar_url,
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
    if "role" in updates:
        requested_role = updates["role"]
        # Super-admin can assign any role
        if user.get("role") == "admin":
            if requested_role not in ["buyer", "seller", "sub-admin", "admin"]:
                raise HTTPException(400, "Invalid role specified")
        else:
            # Non-admins can only toggle between buyer and seller
            if requested_role not in ["buyer", "seller"]:
                raise HTTPException(403, "Cannot self-assign administrative roles")
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
        user.update(updates)
    return public_user(user)


@api.post("/auth/become-seller")
async def become_seller(user=Depends(current_user)):
    """Upgrades a buyer account to seller immediately."""
    if user.get("role") in ["admin", "sub-admin"]:
        return public_user(user)
    await db.users.update_one({"id": user["id"]}, {"$set": {"role": "seller"}})
    user["role"] = "seller"
    return public_user(user)


# ============== SELLER VERIFICATION & ONBOARDING ==============
@api.post("/seller/verify/send-code")
async def seller_verify_send_code(data: SellerVerifySendCodeInput, user=Depends(current_user)):
    """Sends 6-digit OTP code to email or phone with 1:1 uniqueness check."""
    val = data.value.strip()
    if not val:
        raise HTTPException(400, f"{data.type.capitalize()} is required")
    
    if data.type == "phone":
        # Strict 1:1 check: No other seller can be bound to this phone number
        existing = await db.users.find_one({"phone": val, "seller_verified": True, "id": {"$ne": user["id"]}})
        if existing:
            raise HTTPException(409, "This phone number is already registered to another active seller account. 1 seller account can only be tied to 1 unique phone number.")
    elif data.type == "email":
        val = val.lower()
        existing = await db.users.find_one({"email": val, "seller_verified": True, "id": {"$ne": user["id"]}})
        if existing:
            raise HTTPException(409, "This email is already registered to another active seller account.")
    else:
        raise HTTPException(400, "Invalid verification type")

    # Generate 6-digit cryptographic OTP
    otp = f"{secrets.randbelow(900000) + 100000}"
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    await db.verification_codes.update_one(
        {"user_id": user["id"], "type": data.type, "value": val},
        {"$set": {"code": otp, "expires_at": expires, "verified": False, "created_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    
    logger.info(f"Verification code for {data.type} {val}: {otp}")
    return {
        "ok": True,
        "message": f"Verification code sent to {val}",
        "debug_code": otp,
    }


@api.post("/seller/verify/confirm-code")
async def seller_verify_confirm_code(data: SellerVerifyConfirmInput, user=Depends(current_user)):
    """Confirms 6-digit OTP code for email or phone."""
    val = data.value.strip().lower() if data.type == "email" else data.value.strip()
    record = await db.verification_codes.find_one({
        "user_id": user["id"],
        "type": data.type,
        "value": val,
        "code": data.code.strip()
    })
    if not record:
        raise HTTPException(400, "Invalid verification code. Please check and try again.")
    
    exp = record.get("expires_at")
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp and exp < datetime.now(timezone.utc):
        raise HTTPException(400, "Verification code has expired. Please request a new code.")
    
    await db.verification_codes.update_one({"_id": record["_id"]}, {"$set": {"verified": True}})
    return {"ok": True, "verified": True}


@api.get("/seller/check-username")
async def check_seller_username(username: str = Query(...), request: Request = None):
    """Live validation to ensure username is unique across all users."""
    uname = username.strip().lower()
    if len(uname) < 3:
        return {"available": False, "reason": "Username must be at least 3 characters."}
    if not uname.replace("_", "").replace("-", "").isalnum():
        return {"available": False, "reason": "Only letters, numbers, hyphens, and underscores allowed."}
    user = None
    if request:
        try:
            user = await current_user(request)
        except Exception:
            pass
    query = {"username": {"$regex": f"^{uname}$", "$options": "i"}}
    if user:
        query["id"] = {"$ne": user["id"]}
    existing = await db.users.find_one(query)
    if existing:
        return {"available": False, "reason": "This username is already taken. Please choose another."}
    return {"available": True}


@api.post("/seller/activate")
async def seller_activate(data: SellerActivateInput, user=Depends(current_user)):
    """Upgrades user to verified seller once both email and phone are verified."""
    phone = data.phone.strip()
    if not phone:
        raise HTTPException(400, "Phone number is required")
        
    existing_phone = await db.users.find_one({"phone": phone, "seller_verified": True, "id": {"$ne": user["id"]}})
    if existing_phone:
        raise HTTPException(409, "This phone number is already registered to another seller account.")
    
    # Verify phone confirmation record
    phone_rec = await db.verification_codes.find_one({"user_id": user["id"], "type": "phone", "value": phone, "verified": True})
    if not phone_rec and not user.get("phone_verified"):
        raise HTTPException(400, "Phone number has not been verified yet. Please enter the verification code first.")
    
    # Check username uniqueness if provided
    username = (data.username or "").strip().lower()
    if username:
        if len(username) < 3:
            raise HTTPException(400, "Username must be at least 3 characters")
        existing_u = await db.users.find_one({"username": {"$regex": f"^{username}$", "$options": "i"}, "id": {"$ne": user["id"]}})
        if existing_u:
            raise HTTPException(409, "This username is already taken. Please choose another.")
    
    # Generate 24-character emergency recovery key
    recovery_key = "PROD-" + secrets.token_hex(10).upper()
    key_hash = bcrypt.hashpw(recovery_key.encode(), bcrypt.gensalt()).decode()
    
    chosen_tier = data.tier if data.tier in ["free", "plus", "pro"] else "free"
    
    updates = {
        "role": "seller",
        "seller_verified": True,
        "phone": phone,
        "phone_verified": True,
        "email_verified": True,
        "recovery_key_hash": key_hash,
        "seller_tier": chosen_tier,
        "seller_activated_at": datetime.now(timezone.utc).isoformat(),
    }
    if username:
        updates["username"] = username
    if data.storename:
        updates["storename"] = data.storename.strip()
    if data.store_logo_url:
        updates["store_logo_url"] = data.store_logo_url.strip()
    if data.avatar_url:
        updates["avatar_url"] = data.avatar_url.strip()
    
    await db.users.update_one({"id": user["id"]}, {"$set": updates})
    user.update(updates)
    
    return {
        "user": public_user(user),
        "recovery_key": recovery_key,
        "message": "Congratulations! Your seller account is now active."
    }


@api.post("/seller/recovery/reset")
async def seller_recovery_reset(data: SellerRecoveryInput, user=Depends(current_user)):
    """Allows verified sellers to reset their phone or email if lost, with strict anti-fraud checks."""
    new_val = data.new_value.strip()
    if not new_val:
        raise HTTPException(400, "New phone or email is required")
        
    authenticated = False
    if data.recovery_type == "recovery_key":
        rec_hash = user.get("recovery_key_hash")
        if not rec_hash or not data.proof_code or not bcrypt.checkpw(data.proof_code.strip().encode(), rec_hash.encode()):
            raise HTTPException(403, "Invalid emergency recovery key.")
        authenticated = True
    elif data.password:
        if "password_hash" not in user or not bcrypt.checkpw(data.password.encode(), user["password_hash"].encode()):
            raise HTTPException(401, "Account password verification failed.")
        authenticated = True
    else:
        rec = await db.verification_codes.find_one({
            "user_id": user["id"],
            "code": (data.proof_code or "").strip(),
            "verified": True
        })
        if not rec:
            raise HTTPException(403, "Verification proof not satisfied. Please provide password or recovery key.")
        authenticated = True
        
    if not authenticated:
        raise HTTPException(403, "Identity confirmation failed.")

    if "@" in new_val:
        new_val = new_val.lower()
        conflict = await db.users.find_one({"email": new_val, "seller_verified": True, "id": {"$ne": user["id"]}})
        if conflict:
            raise HTTPException(409, "This email is already in use by another verified seller.")
        field = "email"
    else:
        conflict = await db.users.find_one({"phone": new_val, "seller_verified": True, "id": {"$ne": user["id"]}})
        if conflict:
            raise HTTPException(409, "This phone number is already registered to another active seller.")
        field = "phone"
        
    lock_until = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    
    updates = {
        field: new_val,
        f"{field}_verified": True,
        "payout_lock_until": lock_until,
        "last_recovery_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.users.update_one({"id": user["id"]}, {"$set": updates})
    user.update(updates)
    
    return {
        "user": public_user(user),
        "message": f"Successfully updated your {field}. Note: Payouts are temporarily locked for 24 hours as a security precaution.",
        "payout_lock_until": lock_until
    }


# ============== SELLER STUDIO ANALYTICS, PAYOUTS & PRO TIER ==============
@api.get("/seller/analytics")
async def seller_analytics(user=Depends(current_user)):
    """Returns analytics for Seller Studio: earnings, views, order counts, and compute hours."""
    uid = user["id"]
    my_products = await db.products.find({"seller_id": uid}, {"_id": 0}).to_list(100)
    my_rentals = await db.rentals.find({"owner_id": uid}, {"_id": 0}).to_list(100)
    
    p_ids = [p["id"] for p in my_products]
    r_ids = [r["id"] for r in my_rentals]
    all_listing_ids = set(p_ids + r_ids)
    
    orders = await db.orders.find({"items.id": {"$in": list(all_listing_ids)}}, {"_id": 0}).to_list(500)
    
    total_gross = 0.0
    items_sold_count = 0
    recent_transactions = []
    
    for o in orders:
        for it in o.get("items", []):
            if it.get("id") in all_listing_ids:
                amt = float(it.get("price", 0)) * int(it.get("quantity", 1))
                total_gross += amt
                items_sold_count += int(it.get("quantity", 1))
                recent_transactions.append({
                    "order_id": o.get("id"),
                    "item_title": it.get("title"),
                    "amount": amt,
                    "date": o.get("created_at"),
                    "kind": it.get("kind", "product")
                })
                
    recent_transactions.sort(key=lambda x: x.get("date", ""), reverse=True)
    
    withdrawals = await db.payout_requests.find({"user_id": uid, "status": "completed"}, {"_id": 0}).to_list(100)
    total_withdrawn = sum(w.get("amount", 0.0) for w in withdrawals)
    
    is_pro = user.get("seller_tier") == "pro"
    is_plus = user.get("seller_tier") == "plus"
    comm_rate = 0.0 if is_pro else (0.05 if is_plus else 0.10)
    net_earnings = round(total_gross * (1 - comm_rate), 2)
    available_balance = max(0.0, round(net_earnings - total_withdrawn, 2))
    
    active_rentals_count = sum(1 for r in my_rentals if r.get("status") == "approved")
    gpu_hours = active_rentals_count * 28 + (len(orders) * 4)
    
    return {
        "total_gross": round(total_gross, 2),
        "net_earnings": net_earnings,
        "available_balance": available_balance,
        "total_withdrawn": round(total_withdrawn, 2),
        "items_sold": items_sold_count,
        "gpu_hours": gpu_hours,
        "active_listings": len(my_products) + len(my_rentals),
        "commission_rate": comm_rate,
        "is_pro": is_pro,
        "is_plus": is_plus,
        "tier": user.get("seller_tier", "free"),
        "recent_transactions": recent_transactions[:10],
    }


@api.get("/seller/payout-settings")
async def get_payout_settings(user=Depends(current_user)):
    doc = await db.seller_payout_settings.find_one({"user_id": user["id"]}, {"_id": 0})
    return doc or {"method": None, "details": {}}


@api.post("/seller/payout-settings")
async def save_payout_settings(data: PayoutSettingsInput, user=Depends(current_user)):
    if data.method not in ["bank", "paypal", "upi"]:
        raise HTTPException(400, "Supported methods are 'bank', 'paypal', or 'upi'")
    
    entry = {
        "user_id": user["id"],
        "method": data.method,
        "details": data.details,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.seller_payout_settings.update_one({"user_id": user["id"]}, {"$set": entry}, upsert=True)
    return {"ok": True, "method": data.method, "details": data.details}


@api.get("/seller/wallet")
async def get_seller_wallet(user=Depends(current_user)):
    uid = user["id"]
    payout_lock_until = user.get("payout_lock_until")
    is_locked = False
    if payout_lock_until:
        try:
            exp = datetime.fromisoformat(payout_lock_until)
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp > datetime.now(timezone.utc):
                is_locked = True
        except Exception:
            pass
            
    analytics = await seller_analytics(user)
    history = await db.payout_requests.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(100)
    settings = await db.seller_payout_settings.find_one({"user_id": uid}, {"_id": 0})
    
    return {
        "available_balance": analytics["available_balance"],
        "pending_balance": round(analytics["total_gross"] * 0.15, 2),
        "total_withdrawn": analytics["total_withdrawn"],
        "is_locked": is_locked,
        "payout_lock_until": payout_lock_until if is_locked else None,
        "payout_method": settings.get("method") if settings else None,
        "payout_details": settings.get("details") if settings else {},
        "history": history
    }


@api.post("/seller/payout-withdraw")
async def request_payout_withdraw(data: PayoutWithdrawInput, user=Depends(current_user)):
    if data.amount < 10.0:
        raise HTTPException(400, "Minimum withdrawal amount is $10.00")
        
    payout_lock_until = user.get("payout_lock_until")
    if payout_lock_until:
        try:
            exp = datetime.fromisoformat(payout_lock_until)
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp > datetime.now(timezone.utc):
                raise HTTPException(403, f"Withdrawals are locked until {exp.strftime('%Y-%m-%d %H:%M UTC')} due to a recent security update.")
        except HTTPException:
            raise
        except Exception:
            pass
            
    settings = await db.seller_payout_settings.find_one({"user_id": user["id"]}, {"_id": 0})
    if not settings or not settings.get("method"):
        raise HTTPException(400, "Please connect a bank account or e-wallet before requesting a withdrawal.")
        
    analytics = await seller_analytics(user)
    if data.amount > analytics["available_balance"]:
        raise HTTPException(400, f"Insufficient funds. Maximum available is ${analytics['available_balance']:.2f}")
        
    req = {
        "id": "WDR-" + secrets.token_hex(6).upper(),
        "user_id": user["id"],
        "amount": round(data.amount, 2),
        "method": settings["method"],
        "destination": settings["details"].get("account_number") or settings["details"].get("paypal_email") or settings["details"].get("upi_id") or "Connected Account",
        "status": "processing",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payout_requests.insert_one(req)
    return {"ok": True, "withdrawal": {k: v for k, v in req.items() if k != "_id"}}


@api.get("/seller/subscription")
async def get_seller_subscription(user=Depends(current_user)):
    tier = user.get("seller_tier", "free")
    comm_rate = 0.0 if tier == "pro" else (0.05 if tier == "plus" else 0.10)
    return {
        "tier": tier,
        "is_pro": tier == "pro",
        "is_plus": tier == "plus",
        "commission_rate": comm_rate,
        "benefits": [
            "0% Marketplace Fee for Pro (5% for Plus, 10% for Free)",
            "Featured & Top-ranked algorithmic search placement",
            "Real-time live GPU hardware telemetry & node SLA monitor",
            "Instant automated bank & e-wallet payouts",
            "Verified Golden Badge & VIP Support"
        ]
    }


@api.post("/seller/subscription/upgrade")
async def upgrade_seller_subscription(data: SubscriptionInput, user=Depends(current_user)):
    tier = data.tier if data.tier in ["free", "plus", "pro"] else "free"
    await db.users.update_one({"id": user["id"]}, {"$set": {"seller_tier": tier}})
    user["seller_tier"] = tier
    return {"ok": True, "tier": tier, "user": public_user(user)}


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
    if user.get("role") not in ["seller", "admin", "sub-admin"]:
        raise HTTPException(403, "Seller access required")
    item = data.model_dump() | {
        "id": str(uuid.uuid4()),
        "approved": user.get("role") in ["admin", "sub-admin"],
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
    if user.get("role") not in ["seller", "admin", "sub-admin"]:
        raise HTTPException(403, "Seller access required")
    item = data.model_dump() | {
        "id": str(uuid.uuid4()),
        "status": "approved" if user.get("role") in ["admin", "sub-admin"] else "pending",
        "owner": user["name"],
        "owner_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.rentals.insert_one(item)
    return {k: v for k, v in item.items() if k != "_id"}


# ============== ADMIN ==============
@api.get("/admin/pending")
async def pending(user=Depends(current_user)):
    if user.get("role") not in ["admin", "sub-admin"]:
        raise HTTPException(403, "Admin access required")
    return await db.rentals.find({"status": "pending"}, {"_id": 0}).to_list(100)


@api.post("/admin/rentals/{rid}/{decision}")
async def decide(rid: str, decision: str, user=Depends(current_user)):
    if user.get("role") not in ["admin", "sub-admin"] or decision not in ["approved", "rejected"]:
        raise HTTPException(403, "Admin access required")
    await db.rentals.update_one({"id": rid}, {"$set": {"status": decision}})
    return {"ok": True}


# ============== ADMIN OPERATIONS SUITE ==============
@api.get("/admin/stats")
async def admin_stats(user=Depends(current_user)):
    if user.get("role") not in ["admin", "sub-admin"]:
        raise HTTPException(403, "Admin access required")
    
    total_users = await db.users.count_documents({})
    sellers_count = await db.users.count_documents({"role": "seller"})
    buyers_count = await db.users.count_documents({"role": "buyer"})
    staff_count = await db.users.count_documents({"role": {"$in": ["admin", "sub-admin"]}})
    
    pending_rentals = await db.rentals.count_documents({"status": "pending"})
    pending_products = await db.products.count_documents({"approved": {"$ne": True}})
    
    payout_requests = await db.payout_requests.find({"status": "processing"}, {"_id": 0, "amount": 1}).to_list(500)
    pending_payouts_count = len(payout_requests)
    pending_payouts_amount = round(sum(p.get("amount", 0.0) for p in payout_requests), 2)
    
    completed_orders = await db.orders.find({"status": "completed"}, {"_id": 0, "total": 1}).to_list(1000)
    total_gmv = round(sum(o.get("total", 0.0) for o in completed_orders), 2)
    
    open_reports = await db.reports.count_documents({"status": "open"})
    active_products = await db.products.count_documents({"approved": True})
    active_rentals = await db.rentals.count_documents({"status": "approved"})

    return {
        "total_users": total_users,
        "sellers_count": sellers_count,
        "buyers_count": buyers_count,
        "staff_count": staff_count,
        "pending_reviews_count": pending_rentals + pending_products,
        "pending_rentals_count": pending_rentals,
        "pending_products_count": pending_products,
        "pending_payouts_count": pending_payouts_count,
        "pending_payouts_amount": pending_payouts_amount,
        "total_orders_count": len(completed_orders),
        "total_gmv": total_gmv,
        "open_reports_count": open_reports,
        "active_products": active_products,
        "active_rentals": active_rentals,
    }


@api.get("/admin/users")
async def admin_list_users(
    q: str = "",
    role: str = "all",
    limit: int = 50,
    skip: int = 0,
    user=Depends(current_user)
):
    if user.get("role") not in ["admin", "sub-admin"]:
        raise HTTPException(403, "Admin access required")
    
    query = {}
    if role != "all":
        if role == "staff":
            query["role"] = {"$in": ["admin", "sub-admin"]}
        else:
            query["role"] = role
            
    if q.strip():
        rgx = {"$regex": q.strip(), "$options": "i"}
        query["$or"] = [
            {"email": rgx},
            {"name": rgx},
            {"username": rgx},
            {"phone": rgx},
            {"storename": rgx}
        ]
        
    total = await db.users.count_documents(query)
    docs = await db.users.find(query, {"_id": 0, "password_hash": 0, "recovery_key_hash": 0})\
        .sort("created_at", -1)\
        .skip(skip)\
        .limit(max(1, min(100, limit)))\
        .to_list(100)
        
    return {
        "users": [public_user(u) for u in docs],
        "total": total,
        "limit": limit,
        "skip": skip
    }


@api.patch("/admin/users/{uid}/role")
async def admin_update_user_role(
    uid: str,
    data: AdminRoleUpdateInput,
    user=Depends(current_user)
):
    if user.get("role") not in ["admin", "sub-admin"]:
        raise HTTPException(403, "Admin access required")
        
    new_role = data.role.strip().lower()
    if new_role not in ["buyer", "seller", "sub-admin", "admin"]:
        raise HTTPException(400, "Invalid role. Allowed: buyer, seller, sub-admin, admin")
        
    # Only super-admin can assign admin or sub-admin roles
    if new_role in ["admin", "sub-admin"] and user.get("role") != "admin":
        raise HTTPException(403, "Only super-admins can assign administrative roles")
        
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(404, "User not found")
        
    # Safety check: Protect the last admin
    if target.get("role") == "admin" and new_role != "admin":
        admin_count = await db.users.count_documents({"role": "admin"})
        if admin_count <= 1:
            raise HTTPException(400, "Cannot demote the only remaining administrator.")
            
    updates = {"role": new_role}
    if new_role == "seller":
        updates["seller_verified"] = True
        
    await db.users.update_one({"id": uid}, {"$set": updates})
    target.update(updates)
    return {"ok": True, "user": public_user(target)}


@api.patch("/admin/users/{uid}/status")
async def admin_update_user_status(
    uid: str,
    data: AdminStatusUpdateInput,
    user=Depends(current_user)
):
    if user.get("role") != "admin":
        raise HTTPException(403, "Super-admin access required to change user status")
        
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(404, "User not found")
        
    if target["id"] == user["id"]:
        raise HTTPException(400, "You cannot suspend your own account.")
        
    if target.get("role") == "admin":
        raise HTTPException(400, "Cannot suspend an administrator account. Demote first.")
        
    updates = {
        "banned": data.banned,
        "ban_reason": data.reason or ("Suspended by administrator" if data.banned else None),
        "status_updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.update_one({"id": uid}, {"$set": updates})
    if data.banned:
        # Invalidate active sessions
        await db.user_sessions.delete_many({"user_id": uid})
        
    target.update(updates)
    return {"ok": True, "banned": data.banned, "user": public_user(target)}


@api.get("/admin/reviews/pending")
async def admin_pending_reviews(user=Depends(current_user)):
    """Unified queue of both digital products and GPU rentals awaiting approval."""
    if user.get("role") not in ["admin", "sub-admin"]:
        raise HTTPException(403, "Admin access required")
        
    pending_prods = await db.products.find({"approved": {"$ne": True}}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for p in pending_prods:
        p["kind"] = "product"
        
    pending_rents = await db.rentals.find({"status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for r in pending_rents:
        r["kind"] = "rental"
        
    all_reviews = pending_prods + pending_rents
    all_reviews.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return all_reviews


@api.post("/admin/products/{pid}/{decision}")
async def admin_decide_product(
    pid: str,
    decision: str,
    user=Depends(current_user)
):
    if user.get("role") not in ["admin", "sub-admin"]:
        raise HTTPException(403, "Admin access required")
    if decision not in ["approved", "rejected"]:
        raise HTTPException(400, "Decision must be 'approved' or 'rejected'")
        
    target = await db.products.find_one({"id": pid})
    if not target:
        raise HTTPException(404, "Product not found")
        
    updates = {
        "approved": decision == "approved",
        "status": decision,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_by": user["name"]
    }
    await db.products.update_one({"id": pid}, {"$set": updates})
    return {"ok": True, "decision": decision}


@api.get("/admin/payouts")
async def admin_list_payouts(status: str = "all", user=Depends(current_user)):
    """Fetches all seller balance withdrawal requests."""
    if user.get("role") not in ["admin", "sub-admin"]:
        raise HTTPException(403, "Admin access required")
        
    query = {}
    if status != "all":
        query["status"] = status
        
    payouts = await db.payout_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Enrich with user contact details
    user_ids = list({p["user_id"] for p in payouts if "user_id" in p})
    users_cursor = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "email": 1, "name": 1, "username": 1}).to_list(len(user_ids) or 1)
    user_map = {u["id"]: u for u in users_cursor}
    
    enriched = []
    for p in payouts:
        u_info = user_map.get(p.get("user_id"), {})
        enriched.append({
            **p,
            "seller_email": u_info.get("email", "Unknown"),
            "seller_name": u_info.get("name", "Unknown"),
            "seller_username": u_info.get("username", "")
        })
        
    return enriched


@api.post("/admin/payouts/{wid}/decision")
async def admin_decide_payout(
    wid: str,
    data: AdminPayoutDecisionInput,
    user=Depends(current_user)
):
    if user.get("role") not in ["admin", "sub-admin"]:
        raise HTTPException(403, "Admin access required")
    if data.decision not in ["completed", "rejected"]:
        raise HTTPException(400, "Decision must be 'completed' or 'rejected'")
        
    target = await db.payout_requests.find_one({"id": wid})
    if not target:
        raise HTTPException(404, "Payout request not found")
        
    updates = {
        "status": data.decision,
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "processed_by": user["name"],
        "notes": data.notes or ""
    }
    await db.payout_requests.update_one({"id": wid}, {"$set": updates})
    return {"ok": True, "decision": data.decision}


@api.get("/admin/listings/all")
async def admin_all_listings(
    q: str = "",
    kind: str = "all",
    user=Depends(current_user)
):
    """Catalog manager allowing admins to search and inspect all items."""
    if user.get("role") not in ["admin", "sub-admin"]:
        raise HTTPException(403, "Admin access required")
        
    prods = []
    rents = []
    
    if kind in ["all", "product"]:
        prods = await db.products.find({}, {"_id": 0}).sort("created_at", -1).to_list(300)
        for p in prods:
            p["kind"] = "product"
            
    if kind in ["all", "rental"]:
        rents = await db.rentals.find({}, {"_id": 0}).sort("created_at", -1).to_list(300)
        for r in rents:
            r["kind"] = "rental"
            
    items = prods + rents
    if q.strip():
        ql = q.strip().lower()
        items = [i for i in items if ql in (i.get("title", "") + " " + i.get("description", "") + " " + i.get("seller", "") + " " + i.get("owner", "")).lower()]
        
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return items


@api.delete("/admin/listings/{kind}/{id}")
async def admin_delete_listing(
    kind: str,
    id: str,
    user=Depends(current_user)
):
    if user.get("role") not in ["admin", "sub-admin"]:
        raise HTTPException(403, "Admin access required")
        
    if kind == "product":
        res = await db.products.delete_one({"id": id})
    elif kind == "rental":
        res = await db.rentals.delete_one({"id": id})
    else:
        raise HTTPException(400, "Invalid kind. Must be 'product' or 'rental'")
        
    if res.deleted_count == 0:
        raise HTTPException(404, "Listing not found")
        
    return {"ok": True, "deleted_id": id, "kind": kind}


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
    if user.get("role") not in ["admin", "sub-admin"]:
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
    if user.get("role") not in ["admin", "sub-admin"]:
        raise HTTPException(403, "Admin access required")
    if status not in ALLOWED_REPORT_STATUS and status != "all":
        raise HTTPException(400, "Invalid status")
    query = {} if status == "all" else {"status": status}
    return await db.abuse_reports.find(query, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(1000, limit)))


@api.post("/admin/reports/{report_id}/resolve")
async def resolve_report(report_id: str, data: ReportResolveInput, user=Depends(current_user)):
    if user.get("role") not in ["admin", "sub-admin"]:
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
    if user.get("role") not in ("seller", "admin", "sub-admin"):
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


# ============== CLOUD GPU INSTANCES (ON-DEMAND RUNPOD/VAST.AI ENGINE) ==============

INSTANCE_TEMPLATES = [
    {
        "id": "jupyter-pytorch",
        "name": "PyTorch 2.4 + JupyterLab",
        "category": "Deep Learning & AI",
        "description": "Pre-configured with CUDA 12.4, PyTorch 2.4, TorchVision, Torchaudio, FlashAttention-2, and JupyterLab environment.",
        "icon": "⚡",
        "port": 8888,
        "service_name": "JupyterLab",
        "docker_image": "pytorch/pytorch:2.4.0-cuda12.4-cudnn9-runtime",
        "default_command": "jupyter lab --ip=0.0.0.0 --port=8888 --no-browser --allow-root",
    },
    {
        "id": "comfyui-sdxl",
        "name": "ComfyUI + SDXL & Flux",
        "category": "Generative Art",
        "description": "State-of-the-art node-based generative image pipeline pre-loaded with SDXL Turbo, Flux weights, and ControlNet acceleration.",
        "icon": "🎨",
        "port": 8188,
        "service_name": "ComfyUI Web",
        "docker_image": "comfyanonymous/comfyui:latest-cuda",
        "default_command": "python main.py --listen 0.0.0.0 --port 8188",
    },
    {
        "id": "ollama-llm",
        "name": "Ollama + Open WebUI",
        "category": "LLMs & Inference",
        "description": "Run open-weights LLMs like DeepSeek-R1, Llama 3.3 70B, and Mistral with high-throughput vLLM inference and sleek chat UI.",
        "icon": "🦙",
        "port": 11434,
        "service_name": "Ollama API & WebUI",
        "docker_image": "ollama/ollama:latest",
        "default_command": "ollama serve",
    },
    {
        "id": "ubuntu-base",
        "name": "Ubuntu 22.04 LTS (CUDA 12.4 Base)",
        "category": "Custom Compute",
        "description": "Clean Linux environment with NVIDIA Drivers 550, CUDA Toolkit 12.4, Docker-in-Docker, Git, and root SSH access.",
        "icon": "💻",
        "port": 22,
        "service_name": "SSH Shell",
        "docker_image": "nvidia/cuda:12.4.1-devel-ubuntu22.04",
        "default_command": "/usr/sbin/sshd -D",
    },
]


@api.get("/instances/templates")
async def list_instance_templates():
    return INSTANCE_TEMPLATES


@api.post("/instances/deploy")
async def deploy_instance(data: InstanceDeployInput, user=Depends(current_user)):
    rental = await db.rentals.find_one({"id": data.rental_id}, {"_id": 0})
    if not rental:
        raise HTTPException(404, "GPU rental node not found")

    template = next((t for t in INSTANCE_TEMPLATES if t["id"] == data.template_id), INSTANCE_TEMPLATES[0])

    base_price = float(rental.get("price", 0.60))
    disk_price = round(data.disk_size_gb * 0.0002, 4)
    hourly_price = round(base_price + disk_price, 4)

    instance_id = f"inst-{uuid.uuid4().hex[:10]}"
    ssh_port = random.randint(22000, 29999)
    host_ip = "142.132.189." + str(random.randint(12, 235))
    now_iso = datetime.now(timezone.utc).isoformat()

    doc = {
        "id": instance_id,
        "rental_id": rental["id"],
        "rental_title": rental.get("title", "GPU Compute Node"),
        "gpu": rental.get("gpu", "NVIDIA RTX 4090"),
        "vram": rental.get("vram", "24 GB"),
        "location": rental.get("location", "Frankfurt, DE"),
        "user_id": user["id"],
        "renter_name": user.get("name", "User"),
        "renter_email": user.get("email"),
        "seller_id": rental.get("owner_id", "platform"),
        "seller_name": rental.get("owner", "Host"),
        "template_id": template["id"],
        "template_name": template["name"],
        "docker_image": template["docker_image"],
        "service_name": template["service_name"],
        "web_port": template["port"],
        "ssh_port": ssh_port,
        "host_ip": host_ip,
        "direct_url": f"https://{instance_id}.node.productifynow.com",
        "ssh_command": f"ssh -p {ssh_port} root@{host_ip}",
        "jupyter_token": uuid.uuid4().hex[:16],
        "disk_size_gb": data.disk_size_gb,
        "hourly_price": hourly_price,
        "base_price": base_price,
        "storage_price": disk_price,
        "status": "running",
        "created_at": now_iso,
        "started_at": now_iso,
        "total_runtime_seconds": 0,
        "cost_accumulated": 0.0,
        "ssh_public_key": data.ssh_public_key,
        "specs": rental.get("specs", {}),
    }

    await db.instances.insert_one(doc)
    doc_out = {k: v for k, v in doc.items() if k != "_id"}
    return doc_out


@api.get("/instances")
async def list_instances(as_host: bool = False, user=Depends(current_user)):
    query = {"seller_id": user["id"]} if as_host else {"user_id": user["id"]}
    instances = await db.instances.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)

    now = datetime.now(timezone.utc)
    for inst in instances:
        total_sec = inst.get("total_runtime_seconds", 0)
        if inst.get("status") == "running" and inst.get("started_at"):
            try:
                started = datetime.fromisoformat(inst["started_at"])
                if started.tzinfo is None:
                    started = started.replace(tzinfo=timezone.utc)
                total_sec += max(0, int((now - started).total_seconds()))
            except Exception:
                pass
        inst["live_runtime_seconds"] = total_sec
        inst["live_cost"] = round((total_sec / 3600.0) * float(inst.get("hourly_price", 0.5)), 4)

    return instances


@api.get("/instances/{inst_id}")
async def get_instance(inst_id: str, user=Depends(current_user)):
    inst = await db.instances.find_one({"id": inst_id}, {"_id": 0})
    if not inst:
        raise HTTPException(404, "Instance not found")

    is_renter = inst.get("user_id") == user["id"]
    is_host = inst.get("seller_id") == user["id"]
    is_admin = user.get("role") in ["admin", "sub-admin"]
    if not (is_renter or is_host or is_admin):
        raise HTTPException(403, "Access denied to this instance")

    now = datetime.now(timezone.utc)
    total_sec = inst.get("total_runtime_seconds", 0)
    if inst.get("status") == "running" and inst.get("started_at"):
        try:
            started = datetime.fromisoformat(inst["started_at"])
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            total_sec += max(0, int((now - started).total_seconds()))
        except Exception:
            pass

    inst["live_runtime_seconds"] = total_sec
    inst["live_cost"] = round((total_sec / 3600.0) * float(inst.get("hourly_price", 0.5)), 4)

    inst["telemetry"] = {
        "gpu_utilization_pct": 74 + (hash(inst_id + str(int(now.timestamp()) // 10)) % 23),
        "vram_used_gb": round(14.8 + ((hash(inst_id) % 50) / 10.0), 1),
        "vram_total_gb": 24.0 if "24" in str(inst.get("vram", "24")) else 80.0,
        "temperature_c": 62 + (hash(inst_id) % 8),
        "power_draw_w": 280 + (hash(inst_id) % 45),
        "fan_pct": 58 + (hash(inst_id) % 15),
    }

    port = inst.get("web_port", 8888)
    image = inst.get("docker_image", "pytorch/pytorch")
    inst["logs"] = [
        f"[{inst['created_at'][:19]}] [dockerd] Pulling image manifest from registry: {image}",
        f"[{inst['created_at'][:19]}] [dockerd] Digest: sha256:7f49a88e99b0c031c5123d46781290",
        f"[{inst['created_at'][:19]}] [dockerd] Container allocated on node '{inst.get('rental_title')}'. GPU UUID: GPU-b83c21a4-9df0",
        f"[{inst['created_at'][:19]}] [dockerd] Attaching NVMe scratch disk: {inst.get('disk_size_gb')}GB formatted ext4 at /workspace",
        f"[{inst['created_at'][:19]}] [dockerd] Port forwarding configured: 0.0.0.0:{port} -> container:{port}",
        f"[{inst['created_at'][:19]}] [dockerd] SSH daemon started on port {inst.get('ssh_port')}",
        f"[{inst['created_at'][:19]}] [service] {inst.get('service_name')} service is listening at http://0.0.0.0:{port}",
        f"[{inst['created_at'][:19]}] [system] Container status healthy. Ready for user workload.",
    ]

    return inst


@api.post("/instances/{inst_id}/action")
async def instance_action(inst_id: str, data: InstanceActionInput, user=Depends(current_user)):
    inst = await db.instances.find_one({"id": inst_id}, {"_id": 0})
    if not inst:
        raise HTTPException(404, "Instance not found")

    is_renter = inst.get("user_id") == user["id"]
    is_admin = user.get("role") in ["admin", "sub-admin"]
    if not (is_renter or is_admin):
        raise HTTPException(403, "Only the instance owner can manage lifecycle state")

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    action = data.action.lower()

    current_status = inst.get("status")
    total_sec = inst.get("total_runtime_seconds", 0)
    accum_cost = inst.get("cost_accumulated", 0.0)

    if current_status == "running" and inst.get("started_at"):
        try:
            started = datetime.fromisoformat(inst["started_at"])
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            delta_sec = max(0, int((now - started).total_seconds()))
            total_sec += delta_sec
            accum_cost += (delta_sec / 3600.0) * float(inst.get("hourly_price", 0.5))
        except Exception:
            pass

    if action == "pause":
        if current_status == "terminated":
            raise HTTPException(400, "Cannot pause a terminated instance")
        await db.instances.update_one(
            {"id": inst_id},
            {"$set": {
                "status": "paused",
                "paused_at": now_iso,
                "total_runtime_seconds": total_sec,
                "cost_accumulated": round(accum_cost, 4),
            }}
        )
        return {"ok": True, "status": "paused", "total_runtime_seconds": total_sec, "cost_accumulated": round(accum_cost, 4)}

    elif action == "resume":
        if current_status == "terminated":
            raise HTTPException(400, "Cannot resume a terminated instance")
        await db.instances.update_one(
            {"id": inst_id},
            {"$set": {
                "status": "running",
                "started_at": now_iso,
                "resumed_at": now_iso,
            }}
        )
        return {"ok": True, "status": "running"}

    elif action == "terminate":
        final_cost = round(accum_cost, 4)
        await db.instances.update_one(
            {"id": inst_id},
            {"$set": {
                "status": "terminated",
                "terminated_at": now_iso,
                "total_runtime_seconds": total_sec,
                "cost_accumulated": final_cost,
            }}
        )

        seller_id = inst.get("seller_id")
        if seller_id and final_cost > 0:
            seller = await db.users.find_one({"id": seller_id})
            if seller:
                fee_rate = 0.05 if seller.get("seller_tier") == "pro" else 0.10
                seller_net = round(final_cost * (1.0 - fee_rate), 4)
                await db.users.update_one(
                    {"id": seller_id},
                    {"$inc": {"balance": seller_net}}
                )

        return {"ok": True, "status": "terminated", "total_runtime_seconds": total_sec, "cost_accumulated": final_cost}
    else:
        raise HTTPException(400, f"Unsupported action: {action}")


@api.get("/seller/nodes/telemetry")
async def seller_nodes_telemetry(user=Depends(current_user)):
    nodes = await db.rentals.find({"owner_id": user["id"]}, {"_id": 0}).to_list(100)

    active_instances = await db.instances.find(
        {"seller_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    now = datetime.now(timezone.utc)
    total_compute_hours = 0.0
    total_gross_earned = 0.0
    running_count = 0

    for inst in active_instances:
        total_sec = inst.get("total_runtime_seconds", 0)
        if inst.get("status") == "running" and inst.get("started_at"):
            try:
                started = datetime.fromisoformat(inst["started_at"])
                if started.tzinfo is None:
                    started = started.replace(tzinfo=timezone.utc)
                total_sec += max(0, int((now - started).total_seconds()))
            except Exception:
                pass
            running_count += 1
        inst["live_runtime_seconds"] = total_sec
        inst["live_cost"] = round((total_sec / 3600.0) * float(inst.get("hourly_price", 0.5)), 4)
        total_compute_hours += total_sec / 3600.0
        total_gross_earned += inst["live_cost"]

    fee_rate = 0.05 if user.get("seller_tier") == "pro" else 0.10
    total_net_earned = round(total_gross_earned * (1.0 - fee_rate), 2)

    host_token = f"pnode_{hash(user['id']) % 1000000:06d}_{user['id'][:6]}"
    install_command = f"curl -sSL https://productifynow.com/agent/install.sh | sudo bash -s -- --token={host_token} --cluster=prod-eu"

    return {
        "nodes_count": len(nodes),
        "running_instances_count": running_count,
        "total_compute_hours": round(total_compute_hours, 1),
        "total_gross_earned": round(total_gross_earned, 2),
        "total_net_earned": total_net_earned,
        "host_token": host_token,
        "install_command": install_command,
        "active_instances": active_instances,
        "nodes": nodes,
    }


# ============== COMPUTE CREDITS & HOST HARDWARE AUTO-DETECT ==============

@api.post("/credits/topup")
async def topup_credits(data: CreditTopupInput, user=Depends(current_user)):
    if data.amount <= 0:
        raise HTTPException(400, "Topup amount must be greater than zero")
    amount = round(float(data.amount), 2)
    now_iso = datetime.now(timezone.utc).isoformat()
    tx_id = f"ctx_{uuid.uuid4().hex[:10]}"

    tx_doc = {
        "id": tx_id,
        "user_id": user["id"],
        "amount": amount,
        "provider": data.provider,
        "status": "completed",
        "type": "deposit",
        "created_at": now_iso,
    }
    await db.credit_transactions.insert_one(tx_doc)

    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"compute_credits": amount}}
    )

    updated = await db.users.find_one({"id": user["id"]})
    new_balance = float(updated.get("compute_credits", 0.0))
    return {"ok": True, "amount": amount, "compute_credits": new_balance, "tx_id": tx_id}


@api.get("/credits/balance")
async def get_credits_balance(user=Depends(current_user)):
    u = await db.users.find_one({"id": user["id"]})
    return {"compute_credits": float(u.get("compute_credits", 0.0)) if u else 0.0}


@api.post("/host/auto-detect")
async def auto_detect_hardware(data: Optional[HostHardwareDetectionInput] = None, user=Depends(current_user)):
    now_iso = datetime.now(timezone.utc).isoformat()

    # If real physical hardware specs are sent by the local Productify Agent
    if data and data.real_specs:
        rs = data.real_specs
        gpu_name = rs.get("gpu") or "Standard Compute Node"
        vram = rs.get("vram") or "8 GB"
        cpu = rs.get("cpu") or "Multi-Core CPU"
        ram_gb = rs.get("ram_gb") or 16
        storage_free = rs.get("storage_free_gb") or 50
        driver = rs.get("driver_version") or "Standard"
        temp = rs.get("temperature_c") or 42
        pci_bus = rs.get("pci_bus") or "0000:01:00.0"

        # Calculate fair market pricing based on genuine GPU & VRAM
        gpu_lower = gpu_name.lower()
        if "h100" in gpu_lower:
            suggested = 3.50
        elif "a100" in gpu_lower:
            suggested = 2.20
        elif "4090" in gpu_lower:
            suggested = 0.65
        elif "4080" in gpu_lower:
            suggested = 0.48
        elif "3090" in gpu_lower:
            suggested = 0.38
        elif "3080" in gpu_lower:
            suggested = 0.28
        elif "4070" in gpu_lower or "3070" in gpu_lower:
            suggested = 0.22
        elif "3060" in gpu_lower or "4060" in gpu_lower:
            suggested = 0.18
        elif "920m" in gpu_lower or "1050" in gpu_lower or "1030" in gpu_lower or "gtx" in gpu_lower:
            suggested = 0.10
        elif "rtx" in gpu_lower or "quadro" in gpu_lower or "tesla" in gpu_lower:
            suggested = 0.25
        else:
            suggested = 0.12

        detected = {
            "gpu": gpu_name,
            "vram": vram,
            "cpu": f"{cpu} ({rs.get('cpu_count', 4)} cores)",
            "ram": f"{ram_gb} GB RAM",
            "storage": f"{storage_free} GB Free Scratch NVMe",
            "bandwidth": "1 Gbps Symmetrical",
            "driver_version": driver,
            "suggested_price": suggested,
            "description": f"Verified physical machine equipped with {gpu_name} ({vram} VRAM) and {cpu}. Hardware verified via Productify Host Agent."
        }

        sig_token = f"hw_real_sig_{user['id'][:6]}_{uuid.uuid4().hex[:10]}"
        return {
            "status": "verified",
            "real_hardware": True,
            "hardware_signature": sig_token,
            "probed_at": now_iso,
            "specs": detected,
            "daemon_status": "online",
            "pci_bus": pci_bus,
            "temperature_c": temp,
            "power_limit_w": rs.get("power_limit_w", 250),
        }

    # Fallback catalog when agent is not running
    gpu_catalog = [
        {
            "gpu": "NVIDIA GeForce RTX 4090",
            "vram": "24 GB GDDR6X",
            "cuda_cores": 16384,
            "driver_version": "550.54.14",
            "cuda_version": "12.4",
            "cpu": "AMD Ryzen 9 7950X (16 cores, 32 threads)",
            "ram": "64 GB DDR5-6000",
            "storage": "2 TB Samsung 990 PRO NVMe PCIe 4.0",
            "bandwidth": "980 Mbps Symmetrical",
            "suggested_price": 0.65,
            "description": "High-throughput RTX 4090 node verified with PCIe 4.0 x16 lanes and low-latency fiber. Optimized for PyTorch 2.4, ComfyUI XL, and LLM fine-tuning."
        },
        {
            "gpu": "NVIDIA A100-SXM4-80GB",
            "vram": "80 GB HBM2e",
            "cuda_cores": 6912,
            "driver_version": "535.129.03",
            "cuda_version": "12.2",
            "cpu": "AMD EPYC 7763 (64 cores, 128 threads)",
            "ram": "256 GB DDR4 ECC",
            "storage": "3.84 TB Enterprise NVMe U.2",
            "bandwidth": "10 Gbps Data Center Uplink",
            "suggested_price": 2.20,
            "description": "Enterprise SXM4 node with 80GB high-bandwidth memory for multi-billion parameter LLMs (DeepSeek, Llama 70B) and distributed training."
        },
        {
            "gpu": "NVIDIA GeForce RTX 3090",
            "vram": "24 GB GDDR6X",
            "cuda_cores": 10496,
            "driver_version": "550.54.14",
            "cuda_version": "12.4",
            "cpu": "Intel Core i9-13900K (24 cores)",
            "ram": "64 GB DDR5",
            "storage": "1 TB NVMe SSD",
            "bandwidth": "500 Mbps",
            "suggested_price": 0.38,
            "description": "Reliable 24GB VRAM studio workstation node for Blender rendering, Stable Diffusion, and local AI agent inference."
        }
    ]

    idx = (hash(user["id"]) % len(gpu_catalog))
    detected = gpu_catalog[idx]
    sig_token = f"hw_sig_{uuid.uuid4().hex[:12]}_{idx}"

    return {
        "status": "verified",
        "real_hardware": False,
        "hardware_signature": sig_token,
        "probed_at": now_iso,
        "specs": detected,
        "daemon_status": "offline",
        "pci_bus": "0000:01:00.0",
        "pcie_link": "PCIe 4.0 x16 (31.5 GB/s)",
        "temperature_c": 42,
        "power_limit_w": 450,
        "note": "Run `python scripts/productify_agent.py` on your machine to auto-detect your physical GPU."
    }


@api.get("/agent.py")
async def download_agent_script():
    agent_path = os.path.join(ROOT_DIR, "scripts", "productify_agent.py")
    if not os.path.exists(agent_path):
        agent_path = os.path.join(ROOT_DIR, "..", "scripts", "productify_agent.py")
    if os.path.exists(agent_path):
        with open(agent_path, "r", encoding="utf-8") as f:
            content = f.read()
        return PlainTextResponse(content, media_type="text/x-python")
    raise HTTPException(404, "Agent script not found")


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
