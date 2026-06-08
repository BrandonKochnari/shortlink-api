import os
import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
if "DATABASE_URL" not in os.environ:
    os.environ["DATABASE_URL"] = f"sqlite:///{Path(__file__).resolve().parent / 'test_shortlink.db'}"

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402


TEST_DATABASE_URL = os.environ["DATABASE_URL"]
engine_kwargs = {}
if TEST_DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
engine = create_engine(TEST_DATABASE_URL, **engine_kwargs)
TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    return TestClient(app)


def unique_alias(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def auth_headers(client: TestClient) -> dict[str, str]:
    suffix = uuid.uuid4().hex[:8]
    email = f"user-{suffix}@example.com"
    password = "password123"

    register_response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    assert register_response.status_code == 200

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_response.status_code == 200

    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_url(client: TestClient, headers: dict[str, str], **overrides):
    payload = {
        "original_url": "https://example.com",
        "custom_alias": None,
        "expires_at": None,
    }
    payload.update(overrides)
    return client.post("/api/v1/urls/", json=payload, headers=headers)


def test_create_short_url_random_code(client: TestClient):
    headers = auth_headers(client)
    response = create_url(client, headers)

    assert response.status_code == 200

    data = response.json()
    assert data["original_url"] == "https://example.com/"
    assert data["short_code"]
    assert data["short_url"].endswith(data["short_code"])
    assert data["expires_at"] is None


def test_create_short_url_with_custom_alias(client: TestClient):
    headers = auth_headers(client)
    alias = unique_alias("custom")

    response = create_url(
        client,
        headers,
        original_url="https://fastapi.tiangolo.com/",
        custom_alias=alias,
    )

    assert response.status_code == 200

    data = response.json()
    assert data["short_code"] == alias
    assert data["short_url"].endswith(alias)


def test_duplicate_custom_alias_rejected(client: TestClient):
    headers = auth_headers(client)
    alias = unique_alias("duplicate")

    payload = {
        "original_url": "https://example.com",
        "custom_alias": alias,
        "expires_at": None,
    }

    first = client.post("/api/v1/urls/", json=payload, headers=headers)
    second = client.post("/api/v1/urls/", json=payload, headers=headers)

    assert first.status_code == 200
    assert second.status_code == 400
    assert second.json()["detail"] == "Custom Alias Already Exists"


def test_redirect_short_url(client: TestClient):
    headers = auth_headers(client)
    alias = unique_alias("redirect")

    create_response = create_url(client, headers, custom_alias=alias)

    assert create_response.status_code == 200

    response = client.get(f"/{alias}", follow_redirects=False)

    assert response.status_code in [307, 308]
    assert response.headers["location"] == "https://example.com/"


def test_missing_short_code_returns_404(client: TestClient):
    alias = unique_alias("missing")

    response = client.get(f"/{alias}", follow_redirects=False)

    assert response.status_code == 404
    assert response.json()["detail"] == "URL Not Found"


def test_expired_url_returns_410(client: TestClient):
    headers = auth_headers(client)
    alias = unique_alias("expired")

    create_response = create_url(
        client,
        headers,
        custom_alias=alias,
        expires_at="2020-01-01T00:00:00",
    )

    assert create_response.status_code == 200

    redirect_response = client.get(f"/{alias}", follow_redirects=False)

    assert redirect_response.status_code == 410
    assert redirect_response.json()["detail"] == "URL Has Expired"

def test_my_urls_returns_authenticated_users_urls(client: TestClient):
    headers = auth_headers(client)
    alias = unique_alias("my-urls")

    create_response = create_url(client, headers, custom_alias=alias)
    assert create_response.status_code == 200

    response = client.get("/api/v1/urls/my-urls", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["short_code"] == alias

def test_analytics_returns_click_count(client: TestClient):
    headers = auth_headers(client)
    alias = unique_alias("analytics")

    create_response = create_url(client, headers, custom_alias=alias)
    assert create_response.status_code == 200

    redirect_response = client.get(f"/{alias}", follow_redirects=False)
    assert redirect_response.status_code in [307, 308]

    analytics_response = client.get(
        f"/api/v1/urls/{alias}/analytics",
        headers=headers,
    )

    assert analytics_response.status_code == 200
    data = analytics_response.json()
    assert data["short_code"] == alias
    assert data["clicks"] == 1
    assert data["last_clicked"] is not None


def test_deactivate_url_blocks_redirect(client: TestClient):
    headers = auth_headers(client)
    alias = unique_alias("deactivate")

    create_response = create_url(client, headers, custom_alias=alias)
    assert create_response.status_code == 200

    deactivate_response = client.patch(
        f"/api/v1/urls/{alias}/deactivate",
        headers=headers,
    )

    assert deactivate_response.status_code == 200

    redirect_response = client.get(f"/{alias}", follow_redirects=False)

    assert redirect_response.status_code == 410
    assert redirect_response.json()["detail"] == "URL Is Inactive"


def test_activate_url_allows_redirect_again(client: TestClient):
    headers = auth_headers(client)
    alias = unique_alias("activate")

    create_response = create_url(client, headers, custom_alias=alias)
    assert create_response.status_code == 200

    deactivate_response = client.patch(
        f"/api/v1/urls/{alias}/deactivate",
        headers=headers,
    )
    assert deactivate_response.status_code == 200

    activate_response = client.patch(
        f"/api/v1/urls/{alias}/activate",
        headers=headers,
    )
    assert activate_response.status_code == 200

    redirect_response = client.get(f"/{alias}", follow_redirects=False)

    assert redirect_response.status_code in [307, 308]
    assert redirect_response.headers["location"] == "https://example.com/"
