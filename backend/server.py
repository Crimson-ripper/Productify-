from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os, uuid, jwt, bcrypt

ROOT_DIR = os.path.dirname(__file__)
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
app = FastAPI(title="Productify API")
api = APIRouter(prefix="/api")
JWT_SECRET = os.environ["JWT_SECRET"]

class AuthInput(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    role: str = "buyer"

class GoogleInput(BaseModel):
    email: str
    name: Optional[str] = None

class ProductInput(BaseModel):
    title: str
    category: str
    description: str
    price: float
    image: str
    seller: str = "You"

class RentalInput(BaseModel):
    title: str
    gpu: str
    vram: str
    price: float
    location: str
    image: str

class OrderInput(BaseModel):
    items: list
    total: float
    kind: str = "product"

def public_user(user):
    return {"id": user.get("id"), "email": user["email"], "name": user.get("name", "Member"), "role": user.get("role", "buyer")}

def token_for(user):
    return jwt.encode({"sub": user["id"], "exp": datetime.now(timezone.utc) + timedelta(days=7)}, JWT_SECRET, algorithm="HS256")

async def current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Please sign in to continue")
    try:
        payload = jwt.decode(authorization[7:], JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user: raise HTTPException(401, "User not found")
        return user
    except jwt.PyJWTError:
        raise HTTPException(401, "Your session has expired")

@api.get("/")
async def root(): return {"message": "Productify API ready"}

@api.post("/auth/register")
async def register(data: AuthInput):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}): raise HTTPException(409, "An account with this email already exists")
    role = data.role if data.role in ["buyer", "seller"] else "buyer"
    user = {"id": str(uuid.uuid4()), "email": email, "name": data.name or email.split("@")[0].title(), "role": role, "password_hash": bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()}
    await db.users.insert_one(user)
    return {"user": public_user(user), "token": token_for(user)}

@api.post("/auth/login")
async def login(data: AuthInput):
    user = await db.users.find_one({"email": data.email.lower().strip()})
    if not user or not bcrypt.checkpw(data.password.encode(), user["password_hash"].encode()): raise HTTPException(401, "Email or password is incorrect")
    return {"user": public_user(user), "token": token_for(user)}

@api.post("/auth/google")
async def google_demo(data: GoogleInput):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        user = {"id": str(uuid.uuid4()), "email": email, "name": data.name or "Google Member", "role": "buyer", "password_hash": bcrypt.hashpw(uuid.uuid4().hex.encode(), bcrypt.gensalt()).decode()}
        await db.users.insert_one(user)
    return {"user": public_user(user), "token": token_for(user), "demo": True}

@api.get("/auth/me")
async def me(user=__import__("fastapi").Depends(current_user)): return public_user(user)

@api.get("/products")
async def products(q: str = "", category: str = "all"):
    query = {"approved": True}
    if category != "all": query["category"] = category
    rows = await db.products.find(query, {"_id": 0}).to_list(100)
    if q: rows = [r for r in rows if q.lower() in (r["title"] + r["description"]).lower()]
    return rows

@api.get("/rentals")
async def rentals(): return await db.rentals.find({"status": "approved"}, {"_id": 0}).to_list(100)

@api.post("/products")
async def create_product(data: ProductInput, user=__import__("fastapi").Depends(current_user)):
    if user.get("role") not in ["seller", "admin"]: raise HTTPException(403, "Seller access required")
    item = data.model_dump() | {"id": str(uuid.uuid4()), "approved": user.get("role") == "admin", "seller": user["name"]}
    await db.products.insert_one(item); return {k: v for k, v in item.items() if k != "_id"}

@api.post("/rentals")
async def create_rental(data: RentalInput, user=__import__("fastapi").Depends(current_user)):
    if user.get("role") not in ["seller", "admin"]: raise HTTPException(403, "Seller access required")
    item = data.model_dump() | {"id": str(uuid.uuid4()), "status": "approved" if user.get("role") == "admin" else "pending", "owner": user["name"]}
    await db.rentals.insert_one(item); return {k: v for k, v in item.items() if k != "_id"}

@api.post("/orders")
async def create_order(data: OrderInput, user=__import__("fastapi").Depends(current_user)):
    order = data.model_dump() | {"id": "PX-" + uuid.uuid4().hex[:8].upper(), "user_id": user["id"], "created_at": datetime.now(timezone.utc).isoformat(), "status": "completed"}
    await db.orders.insert_one(order); return {k: v for k, v in order.items() if k != "_id"}

@api.get("/orders")
async def orders(user=__import__("fastapi").Depends(current_user)):
    return await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)

@api.get("/admin/pending")
async def pending(user=__import__("fastapi").Depends(current_user)):
    if user.get("role") != "admin": raise HTTPException(403, "Admin access required")
    return await db.rentals.find({"status": "pending"}, {"_id": 0}).to_list(100)

@api.post("/admin/rentals/{rental_id}/{decision}")
async def decide(rental_id: str, decision: str, user=__import__("fastapi").Depends(current_user)):
    if user.get("role") != "admin" or decision not in ["approved", "rejected"]: raise HTTPException(403, "Admin access required")
    await db.rentals.update_one({"id": rental_id}, {"$set": {"status": decision}}); return {"ok": True}

async def seed():
    admin_email, admin_password = os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"]
    if not await db.users.find_one({"email": admin_email}):
        await db.users.insert_one({"id": "admin-productify", "email": admin_email, "name": "Productify Admin", "role": "admin", "password_hash": bcrypt.hashpw(admin_password.encode(), bcrypt.gensalt()).decode()})
    if await db.products.count_documents({}) == 0:
        await db.products.insert_many([
            {"id":"p1","title":"Figma Pro UI Kit","category":"Design","description":"A polished component library for product teams.","price":29,"image":"https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=900&auto=format&fit=crop","seller":"Northstar Studio","approved":True},
            {"id":"p2","title":"LaunchPad Analytics","category":"Software","description":"Understand your product metrics in one clear workspace.","price":49,"image":"https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=900&auto=format&fit=crop","seller":"Metric Labs","approved":True},
            {"id":"p3","title":"Creator Video Presets","category":"Creative","description":"Cinematic color presets for your next story.","price":18,"image":"https://images.unsplash.com/photo-1492724441997-5dc865305da7?q=80&w=900&auto=format&fit=crop","seller":"Framehouse","approved":True},
            {"id":"p4","title":"DevOps Command Center","category":"Development","description":"Ship with confidence using battle-tested dashboards.","price":79,"image":"https://images.unsplash.com/photo-1461749280684-dccba630e2f6?q=80&w=900&auto=format&fit=crop","seller":"Stacksmith","approved":True}
        ])
    if await db.rentals.count_documents({}) == 0:
        await db.rentals.insert_many([
            {"id":"r1","title":"RTX 4090 Creator Node","gpu":"RTX 4090","vram":"24 GB","price":0.62,"location":"Frankfurt, DE","image":"https://images.unsplash.com/photo-1591488320449-011701bb6704?q=80&w=900&auto=format&fit=crop","status":"approved","owner":"Cloudline"},
            {"id":"r2","title":"A100 Training Rig","gpu":"NVIDIA A100","vram":"80 GB","price":2.40,"location":"Ashburn, US","image":"https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=900&auto=format&fit=crop","status":"approved","owner":"Tensor Yard"}
        ])

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","), allow_credentials=False, allow_methods=["*"], allow_headers=["*"])
@app.on_event("startup")
async def startup(): await seed()
@app.on_event("shutdown")
async def shutdown(): client.close()