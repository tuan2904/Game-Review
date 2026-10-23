"""Shared test fixtures for the GameReview backend.

Fixtures build real model rows through the public managers (``UserManager``,
model constructors) and hand them to tests. Authentication is done either via
``APIClient.force_authenticate`` (for permission/ownership tests) or through
the real auth endpoints (for the auth flow itself).

pytest-django creates a dedicated test database and drops it afterwards; the
development database is never touched.
"""

import itertools
from datetime import date

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils.text import slugify
from rest_framework.test import APIClient

from apps.comments.models import Comment
from apps.favorites.models import Favorite
from apps.games.models import Category, Game
from apps.reviews.models import Review

User = get_user_model()

# A valid password that satisfies the project's Django password validators.
TEST_PASSWORD = "Str0ngPass!9x"


@pytest.fixture(autouse=True)
def _clear_cache():
    """Reset DRF throttle counters between tests (LocMemCache persists)."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def make_user(db):
    def _make(email="user@example.com", password=TEST_PASSWORD, **extra):
        return User.objects.create_user(email=email, password=password, **extra)

    return _make


@pytest.fixture
def user(make_user):
    return make_user(email="user@example.com")


@pytest.fixture
def other_user(make_user):
    return make_user(email="other@example.com")


@pytest.fixture
def admin(make_user):
    return make_user(email="admin@example.com", is_staff=True)


@pytest.fixture
def user_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def other_client(api_client, other_user):
    api_client.force_authenticate(user=other_user)
    return api_client


@pytest.fixture
def admin_client(api_client, admin):
    api_client.force_authenticate(user=admin)
    return api_client


@pytest.fixture
def make_category(db):
    counter = itertools.count(1)

    def _make(name=None, slug=None):
        n = next(counter)
        name = name or f"Category {n}"
        return Category.objects.create(name=name, slug=slug or slugify(name) or f"category-{n}")

    return _make


@pytest.fixture
def category(make_category):
    return make_category(name="Action")


@pytest.fixture
def make_game(db, make_category):
    def _make(category=None, **overrides):
        data = {
            "name": "Elden Ring",
            "slug": "elden-ring",
            "description": "Open-world action RPG.",
            "developer": "FromSoftware",
            "publisher": "Bandai Namco",
            "release_date": date(2022, 2, 25),
            "status": Game.Status.ACTIVE,
            "category": category or make_category(),
        }
        data.update(overrides)
        return Game.objects.create(**data)

    return _make


@pytest.fixture
def game(make_game):
    return make_game()


@pytest.fixture
def make_review(db):
    def _make(game, user, rating=4, content="Solid game.", **overrides):
        return Review.objects.create(
            game=game, user=user, rating=rating, content=content, **overrides
        )

    return _make


@pytest.fixture
def review(make_review, game, user):
    return make_review(game=game, user=user)


@pytest.fixture
def make_comment(db):
    def _make(review, user, content="Great analysis.", **overrides):
        return Comment.objects.create(review=review, user=user, content=content, **overrides)

    return _make


@pytest.fixture
def make_favorite(db):
    def _make(user, game):
        return Favorite.objects.create(user=user, game=game)

    return _make
