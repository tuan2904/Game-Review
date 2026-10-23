"""Category endpoint tests: public list, admin-only writes, PROTECT deletion."""

import pytest

from apps.games.models import Category

pytestmark = pytest.mark.django_db

LIST_URL = "/api/v1/categories/"


def _admin_url(pk):
    return f"/api/v1/categories/{pk}/"


def test_list_categories_is_public(api_client, category):
    response = api_client.get(LIST_URL)

    assert response.status_code == 200
    assert response.data["data"]["items"][0]["slug"] == category.slug


def test_create_category_anonymous_401(api_client):
    assert api_client.post(LIST_URL, {"name": "RPG"}, format="json").status_code == 401


def test_create_category_non_admin_403(user_client):
    assert user_client.post(LIST_URL, {"name": "RPG"}, format="json").status_code == 403


def test_create_category_admin_generates_slug(admin_client):
    response = admin_client.post(LIST_URL, {"name": "Action RPG"}, format="json")

    assert response.status_code == 201
    assert response.data["data"]["slug"] == "action-rpg"


def test_create_category_duplicate_name_400(admin_client, category):
    response = admin_client.post(LIST_URL, {"name": category.name}, format="json")

    assert response.status_code == 400
    assert "name" in response.data["errors"]


def test_update_category_admin(admin_client, category):
    response = admin_client.patch(_admin_url(category.id), {"name": "Renamed"}, format="json")

    assert response.status_code == 200
    assert response.data["data"]["name"] == "Renamed"


def test_delete_empty_category_admin(admin_client, make_category):
    target = make_category(name="Empty", slug="empty")

    response = admin_client.delete(_admin_url(target.id))

    assert response.status_code == 200
    assert not Category.objects.filter(pk=target.id).exists()


def test_delete_category_referenced_by_game_conflicts(admin_client, game):
    response = admin_client.delete(_admin_url(game.category.id))

    assert response.status_code == 409
    assert response.data["success"] is False
    assert "games" in response.data["message"]
