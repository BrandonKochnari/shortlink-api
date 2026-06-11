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


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
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
        data={"username": email, "password": password},
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
    assert data["is_active"] is True


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
    assert data[0]["is_active"] is True

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


def test_prefetch_request_does_not_increment_click_count(client: TestClient):
    headers = auth_headers(client)
    alias = unique_alias("prefetch")

    create_response = create_url(client, headers, custom_alias=alias)
    assert create_response.status_code == 200

    prefetch_response = client.get(
        f"/{alias}",
        follow_redirects=False,
        headers={
            "purpose": "prefetch",
            "sec-fetch-mode": "no-cors",
            "sec-fetch-dest": "empty",
        },
    )
    assert prefetch_response.status_code in [307, 308]

    analytics_after_prefetch = client.get(
        f"/api/v1/urls/{alias}/analytics",
        headers=headers,
    )
    assert analytics_after_prefetch.status_code == 200
    assert analytics_after_prefetch.json()["clicks"] == 0

    navigate_response = client.get(
        f"/{alias}",
        follow_redirects=False,
        headers={
            "sec-fetch-mode": "navigate",
            "sec-fetch-dest": "document",
        },
    )
    assert navigate_response.status_code in [307, 308]

    analytics_after_navigation = client.get(
        f"/api/v1/urls/{alias}/analytics",
        headers=headers,
    )
    assert analytics_after_navigation.status_code == 200
    assert analytics_after_navigation.json()["clicks"] == 1


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


def test_create_url_requires_auth(client: TestClient):
    response = client.post(
        "/api/v1/urls/",
        json={
            "original_url": "https://example.com",
            "custom_alias": None,
            "expires_at": None,
        },
    )

    assert response.status_code == 401


def test_user_cannot_view_other_users_analytics(client: TestClient):
    user_a_headers = auth_headers(client)
    alias = unique_alias("other-analytics")

    create_response = create_url(client, user_a_headers, custom_alias=alias)
    assert create_response.status_code == 200

    user_b_headers = auth_headers(client)
    analytics_response = client.get(
        f"/api/v1/urls/{alias}/analytics",
        headers=user_b_headers,
    )

    assert analytics_response.status_code == 403
    assert analytics_response.json()["detail"] == "Invalid Access"


def test_user_cannot_deactivate_other_users_url(client: TestClient):
    user_a_headers = auth_headers(client)
    alias = unique_alias("other-deactivate")

    create_response = create_url(client, user_a_headers, custom_alias=alias)
    assert create_response.status_code == 200

    user_b_headers = auth_headers(client)
    deactivate_response = client.patch(
        f"/api/v1/urls/{alias}/deactivate",
        headers=user_b_headers,
    )

    assert deactivate_response.status_code == 403
    assert deactivate_response.json()["detail"] == "Invalid Access"


def test_user_cannot_delete_other_users_url(client: TestClient):
    user_a_headers = auth_headers(client)
    alias = unique_alias("other-delete")

    create_response = create_url(client, user_a_headers, custom_alias=alias)
    assert create_response.status_code == 200

    user_b_headers = auth_headers(client)
    delete_response = client.delete(
        f"/api/v1/urls/{alias}",
        headers=user_b_headers,
    )

    assert delete_response.status_code == 403
    assert delete_response.json()["detail"] == "Invalid Access"


def test_user_cannot_update_other_users_expiration(client: TestClient):
    user_a_headers = auth_headers(client)
    alias = unique_alias("other-expiration")

    create_response = create_url(client, user_a_headers, custom_alias=alias)
    assert create_response.status_code == 200

    user_b_headers = auth_headers(client)
    update_response = client.patch(
        f"/api/v1/urls/{alias}/expiration",
        headers=user_b_headers,
        json={"expires_at": "2030-01-01T00:00:00"},
    )

    assert update_response.status_code == 403
    assert update_response.json()["detail"] == "Invalid Access"


def test_update_url_expiration(client: TestClient):
    headers = auth_headers(client)
    alias = unique_alias("expiration-update")

    create_response = create_url(client, headers, custom_alias=alias)
    assert create_response.status_code == 200

    update_response = client.patch(
        f"/api/v1/urls/{alias}/expiration",
        headers=headers,
        json={"expires_at": "2030-01-01T00:00:00"},
    )

    assert update_response.status_code == 200
    data = update_response.json()
    assert data["message"] == "URL Expiry Updated"
    assert data["expires_at"].startswith("2030-01-01T00:00:00")


def test_updating_expiration_to_past_blocks_redirect(client: TestClient):
    headers = auth_headers(client)
    alias = unique_alias("expiration-block")

    create_response = create_url(client, headers, custom_alias=alias)
    assert create_response.status_code == 200

    initial_redirect_response = client.get(f"/{alias}", follow_redirects=False)
    assert initial_redirect_response.status_code in [307, 308]

    update_response = client.patch(
        f"/api/v1/urls/{alias}/expiration",
        headers=headers,
        json={"expires_at": "2020-01-01T00:00:00"},
    )
    assert update_response.status_code == 200

    redirect_response = client.get(f"/{alias}", follow_redirects=False)

    assert redirect_response.status_code == 410
    assert redirect_response.json()["detail"] == "URL Has Expired"


def test_delete_url_removes_short_code(client: TestClient):
    headers = auth_headers(client)
    alias = unique_alias("delete-url")

    create_response = create_url(client, headers, custom_alias=alias)
    assert create_response.status_code == 200

    delete_response = client.delete(
        f"/api/v1/urls/{alias}",
        headers=headers,
    )

    assert delete_response.status_code == 200
    assert delete_response.json() == {"message": "URL Deleted"}

    redirect_response = client.get(f"/{alias}", follow_redirects=False)

    assert redirect_response.status_code == 404
    assert redirect_response.json()["detail"] == "URL Not Found"


def test_delete_url_with_click_history_succeeds(client: TestClient):
    headers = auth_headers(client)
    alias = unique_alias("delete-clicks")

    create_response = create_url(client, headers, custom_alias=alias)
    assert create_response.status_code == 200

    first_redirect = client.get(f"/{alias}", follow_redirects=False)
    second_redirect = client.get(f"/{alias}", follow_redirects=False)
    assert first_redirect.status_code in [307, 308]
    assert second_redirect.status_code in [307, 308]

    delete_response = client.delete(
        f"/api/v1/urls/{alias}",
        headers=headers,
    )

    assert delete_response.status_code == 200
    assert delete_response.json() == {"message": "URL Deleted"}

    redirect_response = client.get(f"/{alias}", follow_redirects=False)
    assert redirect_response.status_code == 404


def test_my_urls_does_not_include_other_users_urls(client: TestClient):
    user_a_headers = auth_headers(client)
    alias_a = unique_alias("user-a")
    create_a_response = create_url(client, user_a_headers, custom_alias=alias_a)
    assert create_a_response.status_code == 200

    user_b_headers = auth_headers(client)
    alias_b = unique_alias("user-b")
    create_b_response = create_url(client, user_b_headers, custom_alias=alias_b)
    assert create_b_response.status_code == 200

    my_urls_response = client.get("/api/v1/urls/my-urls", headers=user_a_headers)

    assert my_urls_response.status_code == 200
    short_codes = {url["short_code"] for url in my_urls_response.json()}
    assert alias_a in short_codes
    assert alias_b not in short_codes
