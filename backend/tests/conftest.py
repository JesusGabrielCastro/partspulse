import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def _reset_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def admin_token(client):
    client.post("/api/auth/register", json={"email": "admin@test.com", "password": "Admin123!", "role": "admin"})
    resp = client.post("/api/auth/login", json={"email": "admin@test.com", "password": "Admin123!"})
    return resp.json()["access_token"]


@pytest.fixture
def staff_token(client):
    client.post("/api/auth/register", json={"email": "staff@test.com", "password": "Staff123!", "role": "staff"})
    resp = client.post("/api/auth/login", json={"email": "staff@test.com", "password": "Staff123!"})
    return resp.json()["access_token"]


@pytest.fixture
def supplier_and_part(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    sup = client.post(
        "/api/suppliers", json={"name": "Test Supplier", "currency_code": "USD"}, headers=headers
    ).json()
    part = client.post(
        "/api/parts",
        json={
            "name": "Test Part", "sku": "TP-001", "current_stock": 10,
            "reorder_threshold": 5, "unit_price": "9.99", "supplier_id": sup["id"],
        },
        headers=headers,
    ).json()
    return sup, part
