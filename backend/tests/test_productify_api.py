"""Productify backend regression tests - iteration 4.

Covers auth (JWT & session), catalog, admin decisions, uploads, mocked payments,
orders, profile update, SEO, and CORS.
"""
import io
import os
import uuid

import pytest
import requests
from PIL import Image


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@productify.now"
ADMIN_PASSWORD = "ProductifyAdmin123!"


@pytest.fixture(scope="session")
def client():
    return requests.Session()


@pytest.fixture(scope="session")
def admin_headers(client):
    r = client.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def seller_headers(client):
    email = f"test_seller_{uuid.uuid4().hex[:8]}@example.com"
    r = client.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "TestPass123!", "name": "TEST Seller", "role": "seller"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["user"]


@pytest.fixture(scope="session")
def buyer_headers(client):
    email = f"test_buyer_{uuid.uuid4().hex[:8]}@example.com"
    r = client.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "TestPass123!", "role": "buyer"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["user"]


def _jpeg_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (100, 100), "blue").save(buf, "JPEG")
    return buf.getvalue()


# ----- Catalog -----
def test_catalog_lists_seeded_items(client):
    products = client.get(f"{BASE_URL}/api/products").json()
    rentals = client.get(f"{BASE_URL}/api/rentals").json()
    assert len(products) >= 4
    assert len(rentals) >= 2
    p = client.get(f"{BASE_URL}/api/products/{products[0]['id']}")
    assert p.status_code == 200 and p.json()["id"] == products[0]["id"]


def test_products_search_and_sort(client):
    r = client.get(f"{BASE_URL}/api/products", params={"q": "Figma"})
    assert r.status_code == 200 and any("figma" in x["title"].lower() for x in r.json())
    asc = client.get(f"{BASE_URL}/api/products", params={"sort": "price_asc"}).json()
    assert asc == sorted(asc, key=lambda x: x["price"])


# ----- Auth -----
def test_admin_login_and_me(client, admin_headers):
    me = client.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
    assert me.status_code == 200 and me.json()["role"] == "admin"


def test_register_duplicate_conflict(client):
    email = f"test_dup_{uuid.uuid4().hex[:8]}@example.com"
    r1 = client.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "TestPass123!"})
    assert r1.status_code == 200
    r2 = client.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "TestPass123!"})
    assert r2.status_code == 409


def test_session_endpoint_rejects_fake_id(client):
    r = client.post(f"{BASE_URL}/api/auth/session", json={"session_id": "FAKE_SESSION"})
    assert r.status_code == 401


def test_me_requires_auth(client):
    r = client.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 401


def test_profile_patch_updates(client, buyer_headers):
    hdr, _ = buyer_headers
    r = client.patch(f"{BASE_URL}/api/auth/me", headers=hdr, json={"name": "TEST Updated", "phone": "+15550001111"})
    assert r.status_code == 200 and r.json()["name"] == "TEST Updated" and r.json()["phone"] == "+15550001111"
    me = client.get(f"{BASE_URL}/api/auth/me", headers=hdr).json()
    assert me["name"] == "TEST Updated"


# ----- Uploads -----
def test_upload_and_download_file(client, seller_headers):
    hdr, _ = seller_headers
    files = {"file": ("t.jpg", _jpeg_bytes(), "image/jpeg")}
    r = client.post(f"{BASE_URL}/api/uploads", headers=hdr, files=files)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("path") and body.get("url") and body.get("id")
    dl = client.get(f"{BASE_URL}{body['url']}")
    assert dl.status_code == 200 and dl.headers["content-type"].startswith("image/")


def test_upload_rejects_bad_mime(client, seller_headers):
    hdr, _ = seller_headers
    files = {"file": ("t.txt", b"not an image", "text/plain")}
    r = client.post(f"{BASE_URL}/api/uploads", headers=hdr, files=files)
    assert r.status_code == 400


# ----- Seller / Admin flow -----
def test_seller_create_rental_pending_and_admin_approves(client, seller_headers, admin_headers):
    hdr, _ = seller_headers
    payload = {"title": "TEST Node", "gpu": "RTX 4090", "vram": "24 GB", "price": 0.5, "location": "Test", "image": "https://example.com/a.jpg"}
    r = client.post(f"{BASE_URL}/api/rentals", headers=hdr, json=payload)
    assert r.status_code == 200 and r.json()["status"] == "pending"
    rid = r.json()["id"]
    pending = client.get(f"{BASE_URL}/api/admin/pending", headers=admin_headers)
    assert pending.status_code == 200 and any(x["id"] == rid for x in pending.json())
    dec = client.post(f"{BASE_URL}/api/admin/rentals/{rid}/approved", headers=admin_headers)
    assert dec.status_code == 200


def test_seller_create_product_pending(client, seller_headers):
    hdr, _ = seller_headers
    r = client.post(f"{BASE_URL}/api/products", headers=hdr, json={"title": "TEST Prod", "category": "Software", "description": "d", "price": 5, "image": "https://x/y.jpg"})
    assert r.status_code == 200 and r.json()["approved"] is False


def test_buyer_cannot_create_product(client, buyer_headers):
    hdr, _ = buyer_headers
    r = client.post(f"{BASE_URL}/api/products", headers=hdr, json={"title": "X", "category": "Software", "description": "d", "price": 1, "image": "https://x/y.jpg"})
    assert r.status_code == 403


# ----- Payments (MOCKED) -----
def test_checkout_and_confirm_creates_order(client, buyer_headers):
    hdr, _ = buyer_headers
    checkout = client.post(
        f"{BASE_URL}/api/payments/checkout",
        headers=hdr,
        json={"items": [{"id": "p1", "kind": "product", "quantity": 1}], "provider": "stripe", "origin_url": BASE_URL, "region": "US"},
    )
    assert checkout.status_code == 200, checkout.text
    body = checkout.json()
    assert body["mocked"] is True and body["provider"] == "stripe"
    assert "/payment/processing?session_id=" in body["checkout_url"]
    sid = body["session_id"]
    st = client.get(f"{BASE_URL}/api/payments/status/{sid}").json()
    assert st["payment_status"] == "pending"
    conf = client.post(f"{BASE_URL}/api/payments/confirm/{sid}", headers=hdr)
    assert conf.status_code == 200
    st2 = client.get(f"{BASE_URL}/api/payments/status/{sid}").json()
    assert st2["payment_status"] == "paid"
    orders = client.get(f"{BASE_URL}/api/orders", headers=hdr).json()
    assert any(o["session_id"] == sid and o["status"] == "completed" for o in orders)


def test_checkout_razorpay_uses_inr(client, buyer_headers):
    hdr, _ = buyer_headers
    r = client.post(
        f"{BASE_URL}/api/payments/checkout",
        headers=hdr,
        json={"items": [{"id": "p2", "kind": "product", "quantity": 1}], "provider": "razorpay", "origin_url": BASE_URL, "region": "IN"},
    )
    assert r.status_code == 200 and r.json()["currency"] == "INR"


def test_checkout_requires_auth(client):
    r = requests.post(
        f"{BASE_URL}/api/payments/checkout",
        json={"items": [{"id": "p1", "kind": "product"}], "provider": "stripe", "origin_url": BASE_URL},
    )
    assert r.status_code == 401


# ----- SEO -----
def test_robots_txt(client):
    r = client.get(f"{BASE_URL}/robots.txt")
    assert r.status_code == 200 and "sitemap" in r.text.lower()


def test_sitemap_xml(client):
    r = client.get(f"{BASE_URL}/sitemap.xml")
    assert r.status_code == 200 and "<urlset" in r.text


def test_index_seo_tags(client):
    r = client.get(f"{BASE_URL}/")
    assert r.status_code == 200
    html = r.text.lower()
    assert "canonical" in html and "og:title" in html and "og:description" in html


# ----- CORS -----
def test_cors_allows_credentials(client):
    origin = BASE_URL
    # Cloudflare may return 400 on raw OPTIONS but still emits CORS headers we care about.
    r = client.options(
        f"{BASE_URL}/api/auth/me",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization"},
    )
    assert r.headers.get("access-control-allow-credentials") == "true"
    # Verify explicit origin echo (test against local backend since edge may strip on non-preflight GET)
    try:
        r2 = requests.get("http://localhost:8001/api/", headers={"Origin": origin}, timeout=5)
        allow_origin = r2.headers.get("access-control-allow-origin")
        assert allow_origin and allow_origin != "*"
    except requests.exceptions.RequestException:
        pytest.skip("Local backend not reachable for origin echo check")
