"""Review endpoint tests: public reads, authenticated create, ownership, validation."""

import pytest

from apps.games.models import Game
from apps.reviews.models import Review

pytestmark = pytest.mark.django_db


def _list_url(slug):
    return f"/api/v1/games/{slug}/reviews/"


def _review_url(pk):
    return f"/api/v1/reviews/{pk}/"


def test_list_reviews_is_public(api_client, game, review):
    response = api_client.get(_list_url(game.slug))

    assert response.status_code == 200
    assert response.data["data"]["pagination"]["total"] == 1


def test_create_review_anonymous_401(api_client, game):
    response = api_client.post(
        _list_url(game.slug), {"rating": 4, "content": "Nice."}, format="json"
    )

    assert response.status_code == 401


def test_create_review_success_uses_token_identity(user_client, user, game):
    response = user_client.post(
        _list_url(game.slug),
        {"rating": 5, "content": "Great.", "user": 999, "user_id": 999},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["data"]["rating"] == 5
    assert response.data["data"]["author"]["id"] == user.id
    assert Review.objects.filter(game=game, user=user).exists()


def test_create_duplicate_review_conflicts(user_client, game, review):
    response = user_client.post(
        _list_url(game.slug), {"rating": 3, "content": "Again."}, format="json"
    )

    assert response.status_code == 409
    assert response.data["message"] == "You have already reviewed this game."


@pytest.mark.parametrize("rating", [0, 6, "abc"])
def test_create_review_invalid_rating_400(user_client, game, rating):
    response = user_client.post(
        _list_url(game.slug), {"rating": rating, "content": "Hmm."}, format="json"
    )

    assert response.status_code == 400
    assert "rating" in response.data["errors"]


def test_create_review_missing_rating_400(user_client, game):
    response = user_client.post(_list_url(game.slug), {"content": "No rating."}, format="json")

    assert response.status_code == 400
    assert "rating" in response.data["errors"]


def test_create_review_blank_content_400(user_client, game):
    response = user_client.post(
        _list_url(game.slug), {"rating": 4, "content": "   "}, format="json"
    )

    assert response.status_code == 400
    assert "content" in response.data["errors"]


def test_create_review_on_inactive_game_404_for_user(user_client, make_game):
    hidden = make_game(slug="hidden", status=Game.Status.INACTIVE)

    response = user_client.post(
        _list_url(hidden.slug), {"rating": 4, "content": "Hi."}, format="json"
    )

    assert response.status_code == 404


def test_staff_can_review_inactive_game(admin_client, make_game):
    hidden = make_game(slug="hidden", status=Game.Status.INACTIVE)

    response = admin_client.post(
        _list_url(hidden.slug), {"rating": 4, "content": "Hi."}, format="json"
    )

    assert response.status_code == 201


def test_update_review_owner_success(user_client, review):
    response = user_client.patch(_review_url(review.id), {"rating": 1}, format="json")

    assert response.status_code == 200
    review.refresh_from_db()
    assert review.rating == 1


def test_update_review_other_user_403(other_client, review):
    response = other_client.patch(_review_url(review.id), {"rating": 1}, format="json")

    assert response.status_code == 403


def test_update_review_anonymous_401(api_client, review):
    assert api_client.patch(_review_url(review.id), {"rating": 1}, format="json").status_code == 401


def test_delete_review_owner_success(user_client, review):
    response = user_client.delete(_review_url(review.id))

    assert response.status_code == 200
    assert not Review.objects.filter(pk=review.id).exists()


def test_delete_review_other_user_403(other_client, review):
    assert other_client.delete(_review_url(review.id)).status_code == 403
