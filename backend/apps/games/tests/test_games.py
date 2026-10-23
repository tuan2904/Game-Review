"""Game endpoint tests: public reads, admin-only writes, validation, lifecycle."""

import pytest

from apps.games.models import Game

pytestmark = pytest.mark.django_db

LIST_URL = "/api/v1/games/"


def _detail(slug):
    return f"/api/v1/games/{slug}/"


def _admin_url(pk):
    return f"/api/v1/games/{pk}/"


def _payload(category, **overrides):
    data = {
        "name": "New Game",
        "description": "A new game.",
        "developer": "Studio",
        "publisher": "Publisher",
        "release_date": "2023-01-01",
        "category_id": category.id,
    }
    data.update(overrides)
    return data


# --- reads -----------------------------------------------------------------


def test_list_games_is_public_and_enveloped(api_client, game):
    response = api_client.get(LIST_URL)

    assert response.status_code == 200
    assert response.data["success"] is True
    assert response.data["data"]["pagination"]["total"] == 1
    assert response.data["data"]["items"][0]["slug"] == game.slug


def test_detail_by_slug_is_public(api_client, game):
    response = api_client.get(_detail(game.slug))

    assert response.status_code == 200
    assert response.data["data"]["name"] == game.name
    assert response.data["data"]["category"]["slug"] == game.category.slug


def test_inactive_game_hidden_from_anonymous(game, make_game, api_client):
    make_game(slug="hidden", status=Game.Status.INACTIVE)

    listing = api_client.get(LIST_URL)
    slugs = [item["slug"] for item in listing.data["data"]["items"]]

    assert "hidden" not in slugs
    assert api_client.get(_detail("hidden")).status_code == 404


def test_inactive_game_visible_to_staff(admin_client, make_game):
    make_game(slug="hidden", status=Game.Status.INACTIVE)

    response = admin_client.get(LIST_URL)
    slugs = [item["slug"] for item in response.data["data"]["items"]]

    assert "hidden" in slugs


# --- write permissions -----------------------------------------------------


def test_create_game_anonymous_401(api_client, category):
    response = api_client.post(LIST_URL, _payload(category), format="json")

    assert response.status_code == 401


def test_create_game_non_admin_403(user_client, category):
    response = user_client.post(LIST_URL, _payload(category), format="json")

    assert response.status_code == 403


def test_create_game_admin_success_generates_slug(admin_client, category):
    response = admin_client.post(LIST_URL, _payload(category, name="Brand New"), format="json")

    assert response.status_code == 201
    assert response.data["message"] == "Game created successfully"
    assert response.data["data"]["slug"] == "brand-new"


def test_create_game_unknown_category_400(admin_client, category):
    payload = _payload(category, category_id=999999)

    response = admin_client.post(LIST_URL, payload, format="json")

    assert response.status_code == 400
    assert "category_id" in response.data["errors"]


def test_create_game_numeric_slug_rejected(admin_client, category):
    response = admin_client.post(LIST_URL, _payload(category, slug="123"), format="json")

    assert response.status_code == 400
    assert "slug" in response.data["errors"]


def test_create_game_duplicate_slug_rejected(admin_client, category, game):
    response = admin_client.post(LIST_URL, _payload(category, slug=game.slug), format="json")

    assert response.status_code == 400
    assert "slug" in response.data["errors"]


def test_update_game_non_admin_403(user_client, game):
    response = user_client.patch(_admin_url(game.id), {"status": "INACTIVE"}, format="json")

    assert response.status_code == 403


def test_update_game_admin_success(admin_client, game):
    response = admin_client.patch(_admin_url(game.id), {"status": "INACTIVE"}, format="json")

    assert response.status_code == 200
    game.refresh_from_db()
    assert game.status == Game.Status.INACTIVE


def test_delete_game_anonymous_401(api_client, game):
    assert api_client.delete(_admin_url(game.id)).status_code == 401


def test_delete_game_non_admin_403(user_client, game):
    assert user_client.delete(_admin_url(game.id)).status_code == 403


def test_delete_empty_game_admin_success(admin_client, make_game):
    target = make_game(slug="to-delete")

    response = admin_client.delete(_admin_url(target.id))

    assert response.status_code == 200
    assert not Game.objects.filter(pk=target.id).exists()


def test_delete_game_with_review_conflicts(admin_client, game, review):
    response = admin_client.delete(_admin_url(game.id))

    assert response.status_code == 409
    assert response.data["success"] is False
    assert "reviews" in response.data["message"]
