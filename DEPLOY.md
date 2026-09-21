# DEPLOYMENT GUIDE — Productify

Step-by-step for self-hosting on your own infrastructure. If you'd rather 1-click-deploy on Emergent, just press **Publish** in the toolbar — this doc is only if you're going elsewhere.

---

## Table of contents
1. [Push code to GitHub](#1-push-code-to-github)
2. [Provision MongoDB](#2-provision-mongodb-atlas-free-tier)
3. [Deploy the backend](#3-deploy-the-backend-fastapi)
4. [Deploy the frontend](#4-deploy-the-frontend-react)
5. [Wire the two together](#5-wire-them-together)
6. [Set up a custom domain](#6-set-up-your-custom-domain-productifynowcom)
7. [Go-live checklist](#7-go-live-checklist)

---

## 1. Push code to GitHub

Inside Emergent:
1. Click the **Save** button in the chat input bar.
2. Choose **Save to GitHub**.
3. Authorize GitHub (one-time; requires a paid Emergent plan).
4. Pick or create the repo, pick a branch, click **Save to GitHub**.

⚠️ `.env` files and MongoDB data are **not** pushed for security. Everything else is.

Clone your fresh repo locally:
```bash
git clone https://github.com/<you>/<repo>.git
cd <repo>
```

---

## 2. Provision MongoDB (Atlas free tier)

1. Go to https://cloud.mongodb.com — sign up.
2. Create a project → cluster (M0 Free is fine).
3. **Database Access** → add a DB user with password.
4. **Network Access** → allow `0.0.0.0/0` (or your backend host IPs).
5. Click **Connect → Drivers → Python** and copy the connection string. Replace `<password>`. This becomes `MONGO_URL`.

---

## 3. Deploy the backend (FastAPI)

Pick one:

### Railway (recommended for beginners)
```
1. https://railway.app → New Project → Deploy from GitHub → pick your repo
2. Add a service → Root Directory: /backend
3. Start command:  uvicorn server:app --host 0.0.0.0 --port $PORT
4. Variables tab → paste every key from your backend .env (see README §Environment variables)
5. Deploy. Railway will give you a URL like https://productify-backend.up.railway.app
```

### Render
```
1. https://render.com → New Web Service → connect repo
2. Root Directory: backend
3. Build Command:  pip install -r requirements.txt
4. Start Command:  uvicorn server:app --host 0.0.0.0 --port $PORT
5. Environment tab → paste all backend env keys
```

### Fly.io (Docker)
Create `backend/Dockerfile`:
```Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8001
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```
Then:
```bash
cd backend
fly launch
fly secrets set MONGO_URL="…" DB_NAME="…" JWT_SECRET="…" …
fly deploy
```

### DigitalOcean App Platform
1. Create → Apps → GitHub → pick your repo, `backend/` folder.
2. Type: **Web Service** · Run command `uvicorn server:app --host 0.0.0.0 --port 8080`.
3. Add all env vars.

---

## 4. Deploy the frontend (React)

React CRA builds to a static `build/` folder. Any static host works.

### Vercel (recommended)
```
1. https://vercel.com → Import Git Repo → your repo
2. Root Directory: frontend
3. Framework preset: Create React App
4. Build Command:  yarn build
5. Output Directory:  build
6. Environment Variables:
     REACT_APP_BACKEND_URL = https://<your-backend-url>
7. Deploy.
```

Then add SPA rewrites in `frontend/vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Netlify
Add `frontend/netlify.toml`:
```toml
[build]
  base    = "frontend"
  command = "yarn build"
  publish = "build"

[[redirects]]
  from = "/*"
  to   = "/index.html"
  status = 200
```
Set `REACT_APP_BACKEND_URL` in the Netlify env panel.

### Cloudflare Pages
- Build command: `yarn build`, output: `build`, root: `frontend`.
- Add `_redirects` file in `frontend/public/`:
  ```
  /*   /index.html   200
  ```

---

## 5. Wire them together

Update **backend** env:
```
CORS_ORIGINS=https://productifynow.com,https://www.productifynow.com
FRONTEND_URL=https://productifynow.com
```

Update **frontend** env:
```
REACT_APP_BACKEND_URL=https://api.productifynow.com
```

Redeploy both.

**Quick smoke test after redeploy:**
```bash
curl https://api.productifynow.com/api/policies/versions
# → {"terms":"2026-02-20","privacy":"…", …}

curl https://productifynow.com
# → HTML with <title>Productify — Digital marketplace & GPU rentals</title>
```

---

## 6. Set up your custom domain (productifynow.com)

**DNS records at your registrar** (Namecheap / GoDaddy / Cloudflare):

```
A     productifynow.com          → <static-host-IP-or-CNAME target from Vercel/Netlify>
CNAME www.productifynow.com      → <static-host-CNAME>
CNAME api.productifynow.com      → <backend-host-CNAME, e.g. productify-backend.up.railway.app>
```

Then in Vercel/Netlify → **Domains** → add `productifynow.com`; they issue Let's Encrypt SSL automatically.

For the backend, most hosts (Railway/Render/Fly) also issue TLS on custom subdomains — add `api.productifynow.com` in their Domains tab.

---

## 7. Go-live checklist

- [ ] Regenerate `JWT_SECRET` (`openssl rand -hex 48`) — never reuse the dev secret
- [ ] Set a strong `ADMIN_PASSWORD` (min 12 chars, unique)
- [ ] Configure `CORS_ORIGINS` to your **exact** production origins (no `*`, no trailing slashes)
- [ ] Set `REACT_APP_BACKEND_URL` in the frontend
- [ ] Verify the seeded admin exists — sign in once at `/login`
- [ ] Bump `POLICY_VERSIONS` in Mongo when you edit any legal doc (via `POST /api/admin/policies/versions`)
- [ ] Provide real payment keys before enabling paid checkout: Stripe / Razorpay / PayPal
- [ ] Add a proper favicon + `og-cover.png` in `frontend/public/`
- [ ] Submit `sitemap.xml` to Google Search Console
- [ ] Point `productifynow.com` at your static host, `api.productifynow.com` at your backend
- [ ] Confirm the cookie banner appears on first visit and consent is logged (`GET /api/admin/consents` should show a new row)
- [ ] Test the Google Sign-in redirect end-to-end (cookie `session_token` is set with `Secure; SameSite=None; HttpOnly` after callback)
- [ ] Run `pytest backend/tests/` against production URL as a final smoke test

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `CORS error` in browser console | Add the exact frontend origin (scheme + host, no path) to `CORS_ORIGINS`; restart backend |
| Login works but refresh logs you out | Backend cookie needs `Secure=True, SameSite=None` — make sure both frontend + backend are on HTTPS |
| Upload succeeds but image doesn't render | Frontend expects `${REACT_APP_BACKEND_URL}${data.url}` — check that env var has no trailing slash |
| `country_not_supported` from Stripe | Sandbox provisioning is region-locked; supply your own live Stripe key in `STRIPE_API_KEY` instead |
| Google Sign-in redirects to `/login` with a toast error | Emergent OAuth needs the app to be reachable at the same origin the user started from. Do not hardcode redirect URLs — the code uses `window.location.origin + "/dashboard"` |

Have a nice launch! 🚀
