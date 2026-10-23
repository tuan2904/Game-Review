"""Authentication endpoint tests: register/login/refresh/logout/me.

These exercise the real HTTP flow (no forced authentication) so token issuing,
rotation, blacklisting and the standard response envelope are all verified.
"""

import pytest

from conftest import TEST_PASSWORD

pytestmark = pytest.mark.django_db

REGISTER_URL = "/api/v1/auth/register/"
LOGIN_URL = "/api/v1/auth/login/"
REFRESH_URL = "/api/v1/auth/refresh/"
LOGOUT_URL = "/api/v1/auth/logout/"
ME_URL = "/api/v1/auth/me/"


def _login(api_client, email="user@example.com", password=TEST_PASSWORD):
    return api_client.post(LOGIN_URL, {"email": email, "password": password}, format="json")


def test_register_success_returns_safe_user(api_client):
    response = api_client.post(
        REGISTER_URL,
        {
            "email": "New.User@Example.com",
            "password": TEST_PASSWORD,
            "first_name": "Ada",
            "last_name": "Lovelace",
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["success"] is True
    data = response.data["data"]
    assert data["email"] == "new.user@example.com"
    assert data["first_name"] == "Ada"
    assert data["is_staff"] is False
    assert "password" not in data
    assert "access" not in data  # registration issues no tokens


def test_register_duplicate_email_rejected_case_insensitively(api_client, user):
    response = api_client.post(
        REGISTER_URL,
        {"email": user.email.upper(), "password": TEST_PASSWORD},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["success"] is False
    assert "email" in response.data["errors"]


def test_register_cannot_self_assign_staff_or_superuser(api_client):
    response = api_client.post(
        REGISTER_URL,
        {
            "email": "sneaky@example.com",
            "password": TEST_PASSWORD,
            "is_staff": True,
            "is_superuser": True,
        },
        format="json",
    )

    assert response.status_code == 201
    from django.contrib.auth import get_user_model

    created = get_user_model().objects.get(email="sneaky@example.com")
    assert created.is_staff is False
    assert created.is_superuser is False


def test_register_weak_password_rejected(api_client):
    response = api_client.post(
        REGISTER_URL, {"email": "weak@example.com", "password": "123"}, format="json"
    )

    assert response.status_code == 400
    assert "password" in response.data["errors"]


def test_login_success_returns_tokens_and_user(api_client, user):
    response = _login(api_client)

    assert response.status_code == 200
    assert response.data["success"] is True
    data = response.data["data"]
    assert data["access"]
    assert data["refresh"]
    assert data["user"]["email"] == user.email
    assert "password" not in data["user"]


def test_login_wrong_password_is_generic_401(api_client, user):
    response = _login(api_client, password="WrongPass!123")

    assert response.status_code == 401
    assert response.data["success"] is False
    assert response.data["message"] == "Invalid email or password"


def test_login_unknown_email_is_generic_401(api_client, user):
    response = _login(api_client, email="nobody@example.com")

    assert response.status_code == 401
    assert response.data["message"] == "Invalid email or password"


def test_login_inactive_account_is_generic_401(api_client, make_user):
    make_user(email="inactive@example.com", is_active=False)

    response = _login(api_client, email="inactive@example.com")

    assert response.status_code == 401
    assert response.data["message"] == "Invalid email or password"


def test_me_requires_authentication(api_client):
    response = api_client.get(ME_URL)

    assert response.status_code == 401
    assert response.data["success"] is False


def test_me_returns_current_user(api_client, user):
    access = _login(api_client).data["data"]["access"]

    response = api_client.get(ME_URL, HTTP_AUTHORIZATION=f"Bearer {access}")

    assert response.status_code == 200
    assert response.data["data"]["email"] == user.email


def test_refresh_rotates_and_blacklists_old_token(api_client, user):
    refresh = _login(api_client).data["data"]["refresh"]

    rotated = api_client.post(REFRESH_URL, {"refresh": refresh}, format="json")

    assert rotated.status_code == 200
    new_refresh = rotated.data["data"]["refresh"]
    assert rotated.data["data"]["access"]
    assert new_refresh != refresh

    reused = api_client.post(REFRESH_URL, {"refresh": refresh}, format="json")
    assert reused.status_code == 401


def test_logout_blacklists_refresh_token(api_client, user):
    refresh = _login(api_client).data["data"]["refresh"]

    logout = api_client.post(LOGOUT_URL, {"refresh": refresh}, format="json")
    assert logout.status_code == 200
    assert logout.data["message"] == "Logout successful"

    reuse = api_client.post(REFRESH_URL, {"refresh": refresh}, format="json")
    assert reuse.status_code == 401


def test_logout_with_invalid_token_rejected(api_client):
    response = api_client.post(LOGOUT_URL, {"refresh": "not-a-token"}, format="json")

    assert response.status_code == 401
    assert response.data["success"] is False
