from django.db import IntegrityError, transaction
from rest_framework import serializers

from apps.common.exceptions import ConflictException
from apps.favorites.models import Favorite
from apps.games.models import Game
from apps.games.serializers import CategorySerializer


class FavoriteGameSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)

    class Meta:
        model = Game
        fields = ("id", "name", "slug", "cover_image", "release_date", "status", "category")


class FavoriteSerializer(serializers.ModelSerializer):
    game = FavoriteGameSerializer(read_only=True)

    class Meta:
        model = Favorite
        fields = ("id", "game", "created_at")
        read_only_fields = ("id", "created_at")

    def create(self, validated_data):
        try:
            with transaction.atomic():
                return super().create(validated_data)
        except IntegrityError:
            # Covers both a duplicate request and a uniqueness race.
            raise ConflictException("You have already favorited this game.") from None
