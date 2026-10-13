from django.utils.text import slugify
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from apps.games.models import Category, Game


def generate_unique_slug(model, name, fallback):
    """Deterministic slug: slugify(name), then -2, -3... on collision.

    Purely numeric results are suffixed too, so slugs can never collide with
    the numeric ``/games/{id}/`` admin routes.
    """
    base = slugify(name) or fallback
    slug = base
    suffix = 2
    while slug.isdigit() or model.objects.filter(slug=slug).exists():
        slug = f"{base}-{suffix}"
        suffix += 1
    return slug


class CategorySerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(
        required=False, validators=[UniqueValidator(queryset=Category.objects.all())]
    )

    class Meta:
        model = Category
        fields = ("id", "name", "slug")

    def create(self, validated_data):
        if not validated_data.get("slug"):
            validated_data["slug"] = generate_unique_slug(
                Category, validated_data["name"], fallback="category"
            )
        return super().create(validated_data)


class GameSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source="category", write_only=True
    )
    slug = serializers.SlugField(
        required=False, validators=[UniqueValidator(queryset=Game.objects.all())]
    )

    class Meta:
        model = Game
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "developer",
            "publisher",
            "release_date",
            "cover_image",
            "status",
            "category",
            "category_id",
            "created_at",
            "updated_at",
        )

    def validate_slug(self, value):
        if value.isdigit():
            raise serializers.ValidationError(
                "Slug cannot be purely numeric (it would clash with game IDs)."
            )
        return value

    def create(self, validated_data):
        if not validated_data.get("slug"):
            validated_data["slug"] = generate_unique_slug(
                Game, validated_data["name"], fallback="game"
            )
        return super().create(validated_data)
