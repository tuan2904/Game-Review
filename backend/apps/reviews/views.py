from django.shortcuts import get_object_or_404
from rest_framework.filters import OrderingFilter
from rest_framework.generics import GenericAPIView, ListAPIView, ListCreateAPIView
from rest_framework.mixins import DestroyModelMixin, UpdateModelMixin

from apps.common.filters import ListQueryMixin
from apps.common.permissions import IsAdmin, IsAdminOrOwner
from apps.common.responses import success_response
from apps.games.models import Game
from apps.reviews.models import Review
from apps.reviews.serializers import ReviewSerializer


class GameReviewListCreateView(ListQueryMixin, ListCreateAPIView):
    serializer_class = ReviewSerializer
    success_message = "Reviews retrieved successfully"
    queryset = Review.objects.select_related("game", "user")
    # Reviews are sortable, not searchable: only OrderingFilter is mounted
    # (a `?search=` parameter is ignored rather than half-supported).
    filter_backends = [OrderingFilter]
    ordering_fields = ["created_at", "rating"]
    ordering = "-created_at"

    def get_game(self):
        return get_object_or_404(
            Game.objects.visible_to(self.request.user),
            slug=self.kwargs["slug"],
        )

    def get_queryset(self):
        return self.apply_filters(
            Review.objects.filter(game=self.get_game()).select_related("game", "user")
        )

    def filter_queryset(self, queryset):
        """Order by the allowlisted field, then break ties on ``id``.

        Sorting by rating produces many equal values — the deterministic
        tie-break keeps pagination stable (a review never appears on two
        pages or falls between them).
        """
        queryset = super().filter_queryset(queryset)
        return queryset.order_by(*queryset.query.order_by, "id")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, game=self.get_game())

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return success_response(serializer.data, message="Review created successfully", status=201)


class AdminReviewListView(ListQueryMixin, ListAPIView):
    """Staff-only cross-game review queue (Phase E).

    Game pages already expose their own reviews; this is the moderation view:
    every review regardless of game/visibility, searchable by content, author,
    or game.
    """

    queryset = Review.objects.select_related("game", "user")
    serializer_class = ReviewSerializer
    permission_classes = [IsAdmin]
    success_message = "Reviews retrieved successfully"
    search_fields = [
        "content",
        "game__name",
        "user__email",
        "user__first_name",
        "user__last_name",
    ]
    ordering_fields = ["created_at", "rating"]
    ordering = "-created_at"


class ReviewUpdateDestroyView(UpdateModelMixin, DestroyModelMixin, GenericAPIView):
    queryset = Review.objects.select_related("game", "user")
    serializer_class = ReviewSerializer
    permission_classes = [IsAdminOrOwner]

    def patch(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    def delete(self, request, *args, **kwargs):
        return self.destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return success_response(serializer.data, message="Review updated successfully")

    def destroy(self, request, *args, **kwargs):
        self.perform_destroy(self.get_object())
        return success_response(message="Review deleted successfully")
