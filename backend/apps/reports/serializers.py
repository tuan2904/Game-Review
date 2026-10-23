from rest_framework import serializers

from apps.comments.models import Comment
from apps.common.serializers import SafeUserSerializer
from apps.reports.models import Report
from apps.reviews.models import Review
from apps.reviews.serializers import ReviewGameSerializer


class ReportCreateSerializer(serializers.Serializer):
    """Client payload for POST /reviews|comments/{id}/report/.

    Only ``reason`` (required) and ``details`` (optional free text) come from
    the client — reporter and target are always taken from the URL/user, so a
    crafted body cannot aim the report at other content.
    """

    reason = serializers.ChoiceField(choices=Report.Reason.choices)
    details = serializers.CharField(required=False, allow_blank=True, max_length=500)


class ReportedReviewSerializer(serializers.ModelSerializer):
    game = ReviewGameSerializer(read_only=True)

    class Meta:
        model = Review
        fields = ("id", "rating", "content", "created_at", "game")


class ReportedCommentSerializer(serializers.ModelSerializer):
    game = ReviewGameSerializer(source="review.game", read_only=True)

    class Meta:
        model = Comment
        fields = ("id", "content", "is_hidden", "created_at", "game")


class ReportSerializer(serializers.ModelSerializer):
    """Staff-side report list/detail payload with safe nested targets."""

    reporter = SafeUserSerializer(read_only=True)
    resolved_by = SafeUserSerializer(read_only=True)
    review = ReportedReviewSerializer(read_only=True)
    comment = ReportedCommentSerializer(read_only=True)

    class Meta:
        model = Report
        fields = (
            "id",
            "reason",
            "details",
            "status",
            "reporter",
            "review",
            "comment",
            "resolved_by",
            "resolved_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


__all__ = [
    "ReportCreateSerializer",
    "ReportSerializer",
]
