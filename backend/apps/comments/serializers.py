from rest_framework import serializers

from apps.comments.models import Comment
from apps.common.serializers import SafeUserSerializer


class CommentSerializer(serializers.ModelSerializer):
    # `author`/`review` are read-only: identity comes from the token and the
    # review from the URL, so client-supplied ownership fields are ignored.
    author = SafeUserSerializer(source="user", read_only=True)
    review = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Comment
        fields = ("id", "content", "author", "review", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")
