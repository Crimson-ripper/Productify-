# Productify — PRD

## Original problem statement
E-commerce website for productifynow.com to sell/buy digital products & software, plus GPU/system rental listings after admin verification. Requires proper search, filters and full e-commerce functionality.

## User's product decisions
- Site name: Productify · Domain: productifynow.com
- Auth: Email/password + Emergent-managed Google Sign-in
- Payments: Region-based — Stripe/PayPal for non-India, Razorpay/PayPal for India (Stripe intended real but sandbox is not supported for IN merchant; all 3 currently MOCKED)
- File uploads: Seller listings + user avatars + GPU-rental file transfer workspace
- Roles: buyer, seller, admin (with admin approval for GPU listings)
- Extras: "Professional, multi-layered, SEO configured"

## Architecture
- Frontend: React (CRA + craco) with react-router-dom v7, react-helmet-async for SEO, sonner for toasts
- Backend: FastAPI + Motor (Mongo), httpx, requests, bcrypt, PyJWT
- Storage: Emergent Object Storage (real)
- Auth: httpOnly cookie (session_token) for Google OAuth path; Bearer JWT for email/password
- Deployment: Kubernetes ingress → /api → backend :8001, frontend :3000

## Implemented (2026-02-XX)
- Multi-page routing: /, /shop, /rentals, /product/:id, /rental/:id, /sell, /cart, /checkout, /payment/processing|success|cancel, /login, /register, /profile, /orders, /dashboard, /admin (404 catch-all)
- Emergent Google Sign-in (REAL): redirect to auth.emergentagent.com, backend /api/auth/session exchanges session_id, httpOnly cookie set (7-day)
- Object Storage (REAL): POST /api/uploads (JPG/PNG/WEBP/GIF, 10 MB max) + GET /api/files/{path}
- Payments (MOCKED, region-aware): stripe / razorpay / paypal — server-computed totals with 5% tax, INR for razorpay else USD
- Seller studio: publish digital product / GPU rental with image upload
- Admin console: approve/reject pending rentals
- Profile: name, phone, avatar upload
- Orders: history with amount, provider, status
- SEO: per-page meta via SEO component, canonical, OG, Twitter cards, robots.txt, sitemap.xml, JSON-LD (WebSite + Product)
- Auth-gated routes with ProtectedRoute
- Backward-compatible Bearer JWT for email/password users

## Data model
- users: id, email, name, role (buyer|seller|admin), password_hash, avatar_url, phone, phone_verified, auth_provider
- user_sessions: user_id, session_token, expires_at, created_at
- products: id, title, description, price, category, tags, image, seller, seller_id, type, approved, created_at
- rentals: id, title, gpu, vram, price, location, description, specs, image, owner, owner_id, status (pending|approved|rejected), created_at
- orders: id, user_id, items, total, currency, provider, session_id, status, created_at
- payment_transactions: session_id, user_id, items, subtotal, tax, amount, currency, provider, region, status, payment_status, mocked
- files: id, storage_path, original_filename, content_type, size, user_id, is_deleted, created_at
- workspace_files: id, rental_id, user_id, storage_path, url, filename, note, direction, created_at

## Test credentials
See /app/memory/test_credentials.md. Admin: admin@productify.now / ProductifyAdmin123!.

## Backlog
### P0 (blocked on external creds)
- Real Stripe payments — blocked: sandbox not available for India country. Options: user supplies own Stripe key OR pivot to Razorpay-first
- Real Razorpay integration — needs RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET from user
- Real PayPal integration — needs PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET
- Twilio OTP for phone verification — needs TWILIO_ACCOUNT_SID + AUTH_TOKEN + phone number

### P1 (deferred features)
- GPU rental workspace UI (file transfer between buyer & GPU node) — backend endpoints ready (/api/rentals/{rid}/workspace/files), frontend view pending
- Server-side rendering / static prerender for full crawler SEO (currently CSR with helmet)
- Real-time seller earnings dashboard
- Product reviews & ratings

### P2
- Split /app/backend/server.py into routers per playbook conventions
- Signed download URLs for private files
- Refund flow on orders page
