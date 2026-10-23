"""Favorite endpoint tests: authentication, per-user scoping, duplicates, idempotency."""

import pytest

from apps.favorites.models import Favorite
from apps.games.models import Game

pytestmark = pytest.mark.django_db

MY_FAVORITES_URL = "/api/v1/me/favorites/"


def _favorite_url(slug):
    return f"/api/v1/games/{slug}/favorite/"


def test_add_favorite_anonymous_401(api_client, game):
    assert api_client.post(_favorite_url(game.slug), {}, format="json").status_code == 401


def test_add_favorite_success(user_client, user, game):
    response = user_client.post(_favorite_url(game.slug), {}, format="json")

    assert response.status_code == 201
    assert response.data["data"]["game"]["slug"] == game.slug
    assert Favorite.objects.filter(user=user, game=game).exists()


def test_add_duplicate_favorite_conflicts(user_client, user, game, make_favorite):
    make_favorite(user=user, game=game)

    response = user_client.post(_favorite_url(game.slug), {}, format="json")

    assert response.status_code == 409
    assert response.data["message"] == "You have already favorited this game."


def test_add_favorite_unknown_slug_404(user_client):
    assert user_client.post(_favorite_url("does-not-exist"), {}, format="json").status_code == 404


def test_add_favorite_inactive_game_404_for_user(user_client, make_game):
    hidden = make_game(slug="hidden", status=Game.Status.INACTIVE)

    assert user_client.post(_favorite_url(hidden.slug), {}, format="json").status_code == 404


def test_remove_favorite_is_idempotent(user_client, user, game, make_favorite):
    make_favorite(user=user, game=game)

    first = user_client.delete(_favorite_url(game.slug))
    second = user_client.delete(_favorite_url(game.slug))

    assert first.status_code == 200
    assert second.status_code == 200
    assert not Favorite.objects.filter(user=user, game=game).exists()


def test_remove_favorite_never_touches_another_users_row(
    user_client, other_user, game, make_favorite
):
    make_favorite(user=other_user, game=game)

    response = user_client.delete(_favorite_url(game.slug))

    assert response.status_code == 200
    assert Favorite.objects.filter(user=other_user, game=game).exists()


def test_list_my_favorites_requires_auth(api_client):
    assert api_client.get(MY_FAVORITES_URL).status_code == 401


def test_list_my_favorites_scoped_to_current_user(
    user_client, user, other_user, game, make_game, make_favorite
):
    other_game = make_game(slug="other-game")
    make_favorite(user=user, game=game)
    make_favorite(user=other_user, game=other_game)

    response = user_client.get(MY_FAVORITES_URL)

    assert response.status_code == 200
    slugs = [item["game"]["slug"] for item in response.data["data"]["items"]]
    assert slugs == [game.slug]


def test_list_my_favorites_hides_inactive_games_for_user(
    user_client, user, make_game, make_favorite
):
    hidden = make_game(slug="hidden", status=Game.Status.INACTIVE)
    make_favorite(user=user, game=hidden)

    response = user_client.get(MY_FAVORITES_URL)

    assert response.data["data"]["pagination"]["total"] == 0
