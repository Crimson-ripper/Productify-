# Productify

Full-stack marketplace for **digital products** and **GPU / system rentals** — built for `productifynow.com`.

- 🛒 Multi-page storefront (React + react-router)
- 🔐 Email/password + Google (Emergent-managed OAuth) auth with role-based access (buyer / seller / admin)
- 💳 Region-based checkout (Stripe / Razorpay / PayPal) — currently mocked, drop-in ready
- 🖼️ File & avatar uploads via Emergent Object Storage
- 🛡️ Full policy pack (GDPR / CCPA / DPDP / Privacy Act 1988) with server-side consent logging, policy-version bump prompt, and a public "Report listing" workflow
- 📈 SEO with per-page meta, canonical, OG, Twitter, JSON-LD, sitemap.xml, robots.txt

---

## 📁 Project Layout

```
/app
├── backend/                     # FastAPI + Motor (async Mongo)
│   ├── server.py                # ALL API routes, models, seed, storage init
│   ├── requirements.txt         # Python deps
│   ├── tests/                   # pytest test suite
│   └── .env                     # ⚠ NOT committed — see .env.example
├── frontend/                    # React (Create React App via craco)
│   ├── public/
│   │   ├── index.html           # Base SEO meta + PostHog snippet
│   │   ├── robots.txt           # Crawler rules
│   │   └── sitemap.xml          # All indexed URLs
│   ├── src/
│   │   ├── index.js             # React entry point (HelmetProvider + QueryClient)
│   │   ├── App.js               # Router + AuthProvider + CartProvider + modals
│   │   ├── App.css              # Global styles
│   │   ├── index.css            # Tailwind base + resets
│   │   ├── lib/
│   │   │   └── api.js           # axios instance (Bearer + credentials)
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx  # signed-in user state + login/logout helpers
│   │   │   └── CartContext.jsx  # cart persisted to localStorage
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── ProductCard.jsx
│   │   │   ├── RentalCard.jsx
│   │   │   ├── ImageUpload.jsx  # calls POST /api/uploads
│   │   │   ├── ReportButton.jsx # opens report modal, POST /api/reports
│   │   │   ├── PolicyBumpModal.jsx  # forces re-accept on policy version bump
│   │   │   ├── CookieBanner.jsx # GDPR-style, POSTs to /api/consents
│   │   │   ├── AuthCallback.jsx # handles #session_id= after Google OAuth
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── SEO.jsx          # per-page Helmet meta + JSON-LD
│   │   └── pages/
│   │       ├── Home.jsx
│   │       ├── Shop.jsx
│   │       ├── Rentals.jsx
│   │       ├── ProductDetail.jsx
│   │       ├── RentalDetail.jsx
│   │       ├── Sell.jsx
│   │       ├── Cart.jsx
│   │       ├── Checkout.jsx       # region-based provider selector
│   │       ├── PaymentProcessing.jsx  # polling/confirm screen
│   │       ├── PaymentSuccess.jsx
│   │       ├── PaymentCancel.jsx
│   │       ├── Login.jsx
│   │       ├── Register.jsx
│   │       ├── Profile.jsx
│   │       ├── Orders.jsx
│   │       ├── DashboardHome.jsx  # routes to buyer / seller / admin view
│   │       ├── SellerDashboard.jsx    # Publish product / GPU + Reports history
│   │       ├── AdminDashboard.jsx     # GPU review queue + Abuse reports queue
│   │       ├── NotFound.jsx
│   │       └── policies/
│   │           ├── PolicyLayout.jsx   # shared sidebar + disclaimer
│   │           ├── PrivacyPolicy.jsx
│   │           ├── Terms.jsx
│   │           ├── Refund.jsx
│   │           ├── Cookies.jsx
│   │           ├── AcceptableUse.jsx
│   │           └── Contact.jsx
│   ├── package.json
│   ├── tailwind.config.js
│   └── .env                     # ⚠ NOT committed — see .env.example
├── memory/
│   ├── PRD.md                   # product spec + backlog
│   └── test_credentials.md      # seeded admin login
├── test_reports/                # pytest + playwright reports
└── README.md                    # (this file)
```

---

## 🧠 What each backend module does

Everything lives in **`backend/server.py`** — one file, sectioned by comment banner.
Sections in order:

| Section | Responsibility |
| --- | --- |
| **Storage** | `init_storage()`, `put_object()`, `get_object()` — Emergent Object Storage |
| **Models** | Pydantic `AuthInput`, `SessionInput`, `ProductInput`, `RentalInput`, `CartItemInput`, `CheckoutInput`, `ProfileUpdate`, `ConsentInput`, `ReportInput`, etc. |
| **Auth** | Register / login (JWT), `/auth/session` (Google OAuth exchange), logout, `me`, PATCH profile. `current_user()` checks `session_token` cookie **first**, then `Bearer` JWT (backwards compatible) |
| **Products & Rentals** | List + filter + sort + detail + seller create. Products need admin approval; rentals go through admin queue |
| **Admin** | Pending rentals queue + approve/reject. Reports queue + resolve (dismiss / remove_listing) |
| **Uploads** | `POST /api/uploads` (JPG/PNG/WEBP/GIF, ≤10 MB) → stores in Emergent Object Storage + logs file record in Mongo. `GET /api/files/{path:path}` serves the bytes |
| **Orders & Payments** | Server-computed cart totals, tax, currency. **Payments are mocked** — `checkout` creates a `payment_transactions` row and returns a URL to `/payment/processing`; frontend calls `/payments/confirm/{sid}` after a delay which flips status to paid and creates an `orders` row |
| **Consent Logging** | `POST /api/consents` (anonymous via `anon_id` or signed-in) · `GET /api/consents/me` · `GET /api/admin/consents` |
| **Policy Versions** | `GET /api/policies/versions` · `POST /api/admin/policies/versions` (bumps a version) · `GET /api/consents/status` (returns per-user pending re-accepts) |
| **Abuse Reports** | `POST /api/reports` (public — never auto-hides listings) · `GET /api/admin/reports` · `POST /api/admin/reports/{id}/resolve` (dismiss keeps listing; remove_listing takes it down) · `GET /api/seller/reports` (owner-facing history + reasons) |
| **Rental Workspace** | Endpoints for buyers to attach files to a rented GPU session (backend done; UI backlog) |
| **Seed** | Admin user, 5 sample products, 3 sample rentals, current policy versions |

**Data collections in Mongo**: `users`, `user_sessions`, `products`, `rentals`, `orders`, `payment_transactions`, `files`, `workspace_files`, `consents`, `abuse_reports`, `policy_versions`.

---

## 🎨 What each frontend area does

- **`App.js`** — mounts `BrowserRouter`, `AuthProvider`, `CartProvider`, all routes, `CookieBanner`, `PolicyBumpModal`. Detects `#session_id=` in the URL fragment BEFORE routing and hands off to `AuthCallback`.
- **Auth flow** — `Login.jsx` / `Register.jsx` support email/password (JWT) + a "Continue with Google" button that redirects to `https://auth.emergentagent.com/?redirect=<origin>/dashboard`. On return, `AuthCallback` posts the `session_id` to `/api/auth/session` which sets an httpOnly cookie.
- **Checkout** — `Checkout.jsx` shows the buyer a region picker (US / IN / GB / EU / AU / OTHER) and the providers available for that region. Submit hits `/api/payments/checkout`, then redirects to `/payment/processing`, which auto-confirms and lands on `/payment/success`.
- **Trust & safety** — every product/rental detail page has a "Report this listing" button. Reports mark the listing as `under_review` but never hide it. Admin decides in `/dashboard` (as admin). Sellers see aggregated reports on their listings in `/dashboard` (as seller) → Reports tab.

---

## 🚀 Local setup

### 1. Prereqs
- **Python 3.10+**
- **Node.js 18+** (with **yarn**, NOT npm)
- **MongoDB 6+** running locally on `27017` (or Atlas connection string)

### 2. Clone
```bash
git clone <your-repo-url>
cd <your-repo-name>
```

### 3. Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate    # optional but recommended
pip install -r requirements.txt
cp .env.example .env                                  # then fill in values
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Backend now serves at **http://localhost:8001**. All endpoints are prefixed with `/api`.

### 4. Frontend
```bash
cd frontend
yarn install
cp .env.example .env                                  # then fill in values
yarn start
```

Frontend now serves at **http://localhost:3000**.

### 5. Log in as admin (seeded on first run)
- Email: `admin@productify.now`
- Password: value of `ADMIN_PASSWORD` in your backend `.env`

---

## 🔐 Environment variables

### `backend/.env`
| Key | What it does | Example |
| --- | --- | --- |
| `MONGO_URL` | Mongo connection string | `mongodb://localhost:27017` |
| `DB_NAME` | Mongo database name | `productify` |
| `JWT_SECRET` | Symmetric key for JWT signing — **generate a fresh long random string** | `openssl rand -hex 48` |
| `CORS_ORIGINS` | Comma-separated list of frontend origins | `http://localhost:3000,https://productifynow.com` |
| `ADMIN_EMAIL` | Seed admin email | `admin@productifynow.com` |
| `ADMIN_PASSWORD` | Seed admin password | `ChangeMe-123!` |
| `EMERGENT_LLM_KEY` | Universal key for Emergent Object Storage (get from Emergent dashboard) | `sk-emergent-…` |
| `INTEGRATION_PROXY_URL` | Emergent integrations proxy base | `https://integrations.emergentagent.com` |
| `APP_NAME` | Path prefix inside object storage bucket | `productify` |
| `FRONTEND_URL` | Public frontend URL (used for absolute file URLs) | `https://productifynow.com` |
| `STRIPE_API_KEY` *(optional)* | Real Stripe key when you go live | `sk_test_…` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` *(optional)* | Razorpay live |  |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` *(optional)* | PayPal live |  |
| `TWILIO_*` *(optional)* | Twilio SMS OTP when you enable it |  |

### `frontend/.env`
| Key | What it does |
| --- | --- |
| `REACT_APP_BACKEND_URL` | Public URL of your backend (must include scheme, no trailing slash). All API calls prefix `/api` onto this. Example: `https://api.productifynow.com` or `http://localhost:8001` in dev. |
| `WDS_SOCKET_PORT` *(dev only)* | Dev-server HMR port. Set to `443` behind HTTPS proxies. |

---

## 🌐 Deployment options

### Option A — Emergent 1-click deploy (easiest)
Click **Publish** in the Emergent toolbar. Managed Mongo, SSL, custom domain, automatic env-var injection.

### Option B — Self-host (Vercel / Railway / Render / DO / AWS)
Because the app is React + FastAPI + Mongo, host each piece separately:

**Backend** (FastAPI):
- **Railway / Render / Fly.io** — start command `uvicorn server:app --host 0.0.0.0 --port $PORT`
- Add all `backend/.env` values as service secrets

**Frontend** (React static build):
- **Vercel / Netlify / Cloudflare Pages** — build command `yarn build`, output `build/`
- Set `REACT_APP_BACKEND_URL` in the platform's env panel
- For SPA routing, add a rewrite: `/* → /index.html`

**MongoDB**:
- **MongoDB Atlas** free tier is more than enough to start. Copy the connection string into `MONGO_URL`.

**Object Storage**:
- The current build uses **Emergent Object Storage** via the universal key. If you self-host away from Emergent, you can either (a) keep using it by shipping `EMERGENT_LLM_KEY` + `INTEGRATION_PROXY_URL`, or (b) swap `put_object`/`get_object` in `server.py` for S3/R2/GCS — the surface is 2 functions.

**CORS**:
- Update `CORS_ORIGINS` in the backend env to include your production frontend URL(s). Keep it explicit (not `*`) because we use credentialed cookies for Google auth.

---

## 🧪 Testing
```bash
cd backend
export $(grep -v '^#' ../frontend/.env | xargs)
pytest tests/
```

---

## 🛣️ Roadmap (from `memory/PRD.md`)
- Real Stripe / Razorpay / PayPal payments once keys are in place
- Twilio OTP for seller phone verification
- Rental workspace UI (file transfer to/from rented GPU node)
- Server-side rendering for full crawler SEO
- Product reviews & ratings

## 📜 License
Add a `LICENSE` file before publishing — MIT is a safe default for open-source; keep source private otherwise.
