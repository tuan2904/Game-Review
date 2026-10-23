from rest_framework import serializers

from apps.comments.models import Comment
from apps.comments.moderation import find_banned_word
from apps.common.serializers import SafeUserSerializer
from apps.reviews.serializers import ReviewGameSerializer


class CommentSerializer(serializers.ModelSerializer):
    # `author`/`review` are read-only: identity comes from the token and the
    # review from the URL, so client-supplied ownership fields are ignored.
    # `is_hidden` is moderation state — only staff may change it, and only via
    # the dedicated moderate endpoint (never through this serializer).
    author = SafeUserSerializer(source="user", read_only=True)
    review = serializers.PrimaryKeyRelatedField(read_only=True)
    is_hidden = serializers.BooleanField(read_only=True)

    class Meta:
        model = Comment
        fields = ("id", "content", "author", "review", "is_hidden", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_content(self, value):
        # Length/blank are handled by the field (model max_length + allow_blank
        # = False). The banned-word filter adds a friendly, generic 400 that
        # never echoes the matched word back to the client.
        if find_banned_word(value):
            raise serializers.ValidationError("This comment contains language that isn't allowed.")
        return value


class CommentModerationSerializer(serializers.Serializer):
    """Staff-only payload for the moderate endpoint."""

    is_hidden = serializers.BooleanField()


class AdminCommentSerializer(serializers.ModelSerializer):
    """Staff-only comment list (Phase E moderation queue).

    Same safe author shape as the public payload, plus the parent game for
    cross-game review — ``game`` is nested because a comment's own target is
    its review, which has no public detail page of its own.
    """

    author = SafeUserSerializer(source="user", read_only=True)
    game = ReviewGameSerializer(source="review.game", read_only=True)
    review = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Comment
        fields = (
            "id",
            "content",
            "author",
            "game",
            "review",
            "is_hidden",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields
