import os
import uuid
import requests

import pytest


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@productify.now"
ADMIN_PASSWORD = "ProductifyAdmin123!"


@pytest.fixture(scope="session")
def client():
    return requests.Session()


def token(response):
    assert response.status_code == 200, response.text
    data = response.json()
    assert isinstance(data.get("token"), str)
    return data["token"]


def test_public_catalog_and_search(client):
    products = client.get(f"{BASE_URL}/api/products")
    rentals = client.get(f"{BASE_URL}/api/rentals")
    assert products.status_code == 200 and isinstance(products.json(), list)
    assert rentals.status_code == 200 and isinstance(rentals.json(), list)
    assert client.get(f"{BASE_URL}/api/products", params={"q": "Figma"}).status_code == 200


def test_admin_login_and_me(client):
    auth = client.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    bearer = {"Authorization": f"Bearer {token(auth)}"}
    me = client.get(f"{BASE_URL}/api/auth/me", headers=bearer)
    assert me.status_code == 200
    assert me.json()["role"] == "admin"


def test_seller_register_create_pending_rental_and_admin_decision(client):
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    reg = client.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "TestPass123!", "name": "TEST Seller", "role": "seller"})
    seller_token = token(reg)
    seller_headers = {"Authorization": f"Bearer {seller_token}"}
    rental = client.post(f"{BASE_URL}/api/rentals", headers=seller_headers, json={"title": "TEST Node", "gpu": "RTX 4090", "vram": "24 GB", "price": 0.5, "location": "Test", "image": "https://example.com/node.jpg"})
    assert rental.status_code == 200 and rental.json()["status"] == "pending"
    admin_auth = client.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    admin_headers = {"Authorization": f"Bearer {token(admin_auth)}"}
    pending = client.get(f"{BASE_URL}/api/admin/pending", headers=admin_headers)
    assert pending.status_code == 200
    assert any(row["id"] == rental.json()["id"] for row in pending.json())
    decision = client.post(f"{BASE_URL}/api/admin/rentals/{rental.json()['id']}/approved", headers=admin_headers)
    assert decision.status_code == 200 and decision.json()["ok"] is True


def test_buyer_cannot_create_and_authenticated_mock_order(client):
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    reg = client.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "TestPass123!", "role": "buyer"})
    buyer_token = token(reg)
    headers = {"Authorization": f"Bearer {buyer_token}"}
    denied = client.post(f"{BASE_URL}/api/products", headers=headers, json={"title": "TEST", "category": "Software", "description": "d", "price": 1, "image": "https://example.com/a.jpg"})
    assert denied.status_code == 403
    order = client.post(f"{BASE_URL}/api/orders", headers=headers, json={"items": [{"id": "p1"}], "total": 29, "kind": "product"})
    assert order.status_code == 200 and order.json()["status"] == "completed"