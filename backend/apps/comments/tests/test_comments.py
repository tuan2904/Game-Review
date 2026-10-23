"""Comment endpoint tests: public reads, authenticated create, ownership, visibility."""

import pytest

from apps.comments.models import Comment
from apps.games.models import Game

pytestmark = pytest.mark.django_db


def _list_url(review_id):
    return f"/api/v1/reviews/{review_id}/comments/"


def _comment_url(pk):
    return f"/api/v1/comments/{pk}/"


def test_list_comments_is_public(api_client, review, make_comment, user):
    make_comment(review=review, user=user)

    response = api_client.get(_list_url(review.id))

    assert response.status_code == 200
    assert response.data["data"]["pagination"]["total"] == 1


def test_list_comments_unknown_review_404(api_client):
    assert api_client.get(_list_url(999999)).status_code == 404


def test_create_comment_anonymous_401(api_client, review):
    response = api_client.post(_list_url(review.id), {"content": "Hi."}, format="json")

    assert response.status_code == 401


def test_create_comment_success_uses_token_identity(user_client, user, review, other_user):
    response = user_client.post(
        _list_url(review.id),
        {"content": "Nice review.", "user": other_user.id, "review": 999},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["data"]["author"]["id"] == user.id
    assert response.data["data"]["review"] == review.id


def test_create_comment_blank_content_400(user_client, review):
    response = user_client.post(_list_url(review.id), {"content": "   "}, format="json")

    assert response.status_code == 400
    assert "content" in response.data["errors"]


def test_create_comment_on_inactive_game_review_404_for_user(user_client, review):
    review.game.status = Game.Status.INACTIVE
    review.game.save(update_fields=["status"])

    response = user_client.post(_list_url(review.id), {"content": "Hi."}, format="json")

    assert response.status_code == 404


def test_staff_can_comment_on_inactive_game_review(admin_client, review):
    review.game.status = Game.Status.INACTIVE
    review.game.save(update_fields=["status"])

    response = admin_client.post(_list_url(review.id), {"content": "Hi."}, format="json")

    assert response.status_code == 201


def test_update_comment_owner_success(user_client, review, make_comment, user):
    comment = make_comment(review=review, user=user)

    response = user_client.patch(_comment_url(comment.id), {"content": "Edited."}, format="json")

    assert response.status_code == 200
    comment.refresh_from_db()
    assert comment.content == "Edited."


def test_update_comment_other_user_403(other_client, review, make_comment, user):
    comment = make_comment(review=review, user=user)

    response = other_client.patch(_comment_url(comment.id), {"content": "Hijack."}, format="json")

    assert response.status_code == 403


def test_update_comment_anonymous_401(api_client, review, make_comment, user):
    comment = make_comment(review=review, user=user)

    assert (
        api_client.patch(_comment_url(comment.id), {"content": "x"}, format="json").status_code
        == 401
    )


def test_delete_comment_owner_success(user_client, review, make_comment, user):
    comment = make_comment(review=review, user=user)

    response = user_client.delete(_comment_url(comment.id))

    assert response.status_code == 200
    assert not Comment.objects.filter(pk=comment.id).exists()


def test_delete_comment_other_user_403(other_client, review, make_comment, user):
    comment = make_comment(review=review, user=user)

    assert other_client.delete(_comment_url(comment.id)).status_code == 403
