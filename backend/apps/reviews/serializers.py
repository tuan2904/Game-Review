from django.db import IntegrityError, transaction
from rest_framework import serializers

from apps.common.exceptions import ConflictException
from apps.common.serializers import SafeUserSerializer
from apps.games.models import Game
from apps.reviews.models import Review


class ReviewGameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = ("id", "slug", "name")


class ReviewSerializer(serializers.ModelSerializer):
    author = SafeUserSerializer(source="user", read_only=True)
    game = ReviewGameSerializer(read_only=True)
    rating = serializers.IntegerField(min_value=1, max_value=5)

    class Meta:
        model = Review
        fields = (
            "id",
            "rating",
            "content",
            "author",
            "game",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def create(self, validated_data):
        try:
            with transaction.atomic():
                return super().create(validated_data)
        except IntegrityError:
            raise ConflictException("You have already reviewed this game.") from None
