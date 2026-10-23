"""Rate-limiting tests for the auth endpoints.

Throttle budgets are scoped (``login`` and ``register``) and applied only to
those two views. The counters live in the cache; the autouse fixture in
conftest clears it between tests.
"""

import pytest
from rest_framework.settings import api_settings

pytestmark = pytest.mark.django_db

LOGIN_URL = "/api/v1/auth/login/"
REGISTER_URL = "/api/v1/auth/register/"


def _rate_limit(scope):
    return int(api_settings.DEFAULT_THROTTLE_RATES[scope].split("/")[0])


def test_login_throttle_returns_429_envelope(api_client, user):
    limit = _rate_limit("login")

    for _ in range(limit):
        allowed = api_client.post(
            LOGIN_URL, {"email": user.email, "password": "Wrong!123"}, format="json"
        )
        assert allowed.status_code == 401

    blocked = api_client.post(
        LOGIN_URL, {"email": user.email, "password": "Wrong!123"}, format="json"
    )

    assert blocked.status_code == 429
    assert blocked.data["success"] is False
    assert blocked.data["message"]
    assert "errors" in blocked.data


def test_register_throttle_returns_429_envelope(api_client):
    limit = _rate_limit("register")

    for _ in range(limit):
        allowed = api_client.post(REGISTER_URL, {"email": "spam@example.com"}, format="json")
        assert allowed.status_code == 400  # missing password, still counted

    blocked = api_client.post(REGISTER_URL, {"email": "spam@example.com"}, format="json")

    assert blocked.status_code == 429
    assert blocked.data["success"] is False


def test_login_and_register_budgets_are_independent(api_client, user):
    register_limit = _rate_limit("register")
    for _ in range(register_limit + 1):
        api_client.post(REGISTER_URL, {"email": "spam@example.com"}, format="json")

    # Register is now throttled, but login still has its own budget.
    login_response = api_client.post(
        LOGIN_URL, {"email": user.email, "password": "Wrong!123"}, format="json"
    )
    assert login_response.status_code == 401
