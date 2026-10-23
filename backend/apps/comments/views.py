from django.shortcuts import get_object_or_404
from rest_framework.generics import GenericAPIView, ListAPIView, ListCreateAPIView
from rest_framework.mixins import DestroyModelMixin, UpdateModelMixin

from apps.comments.models import Comment
from apps.comments.serializers import (
    AdminCommentSerializer,
    CommentModerationSerializer,
    CommentSerializer,
)
from apps.common.filters import ListQueryMixin
from apps.common.permissions import IsAdmin, IsAdminOrOwner
from apps.common.responses import success_response
from apps.games.models import Game
from apps.reviews.models import Review


def apply_hidden_filter(queryset, raw):
    """Staff-only ``?is_hidden=`` narrowing (Phase B, reused by Phase E).

    Recognized values (``true/false``, ``1/0``, ``yes/no`` — any case, padded)
    narrow the list; anything else yields an empty result rather than silently
    dropping the filter (a typo must never widen the scope of a moderation
    view).
    """
    normalized = (raw or "").strip().lower()
    if normalized in ("1", "true", "yes"):
        return queryset.filter(is_hidden=True)
    if normalized in ("0", "false", "no"):
        return queryset.filter(is_hidden=False)
    return queryset.none()


class CommentListCreateView(ListCreateAPIView):
    serializer_class = CommentSerializer
    success_message = "Comments retrieved successfully"
    queryset = Comment.objects.select_related("user", "review")

    def get_review(self):
        # Comments follow the game's visibility: an inactive game's review is
        # 404 for anonymous and non-staff users, visible to staff.
        return get_object_or_404(
            Review.objects.filter(game__in=Game.objects.visible_to(self.request.user)),
            pk=self.kwargs["review_id"],
        )

    def get_queryset(self):
        queryset = self.queryset.filter(review=self.get_review()).order_by("-created_at")
        user = self.request.user
        if not (user.is_authenticated and user.is_staff):
            # Hidden comments are never exposed to anonymous or ordinary users —
            # even when they pass `?is_hidden=` themselves.
            return queryset.filter(is_hidden=False)
        # Staff moderation filter: `?is_hidden=true|false` (absent → all).
        raw = self.request.query_params.get("is_hidden")
        if raw is not None:
            return apply_hidden_filter(queryset, raw)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, review=self.get_review())

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return success_response(serializer.data, message="Comment created successfully", status=201)


class CommentUpdateDestroyView(UpdateModelMixin, DestroyModelMixin, GenericAPIView):
    queryset = Comment.objects.select_related("user", "review")
    serializer_class = CommentSerializer
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
        return success_response(serializer.data, message="Comment updated successfully")

    def destroy(self, request, *args, **kwargs):
        self.perform_destroy(self.get_object())
        return success_response(message="Comment deleted successfully")


class CommentModerationView(GenericAPIView):
    """Staff-only hide/unhide for a single comment."""

    queryset = Comment.objects.select_related("user", "review")
    serializer_class = CommentModerationSerializer
    permission_classes = [IsAdmin]

    def post(self, request, *args, **kwargs):
        comment = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment.is_hidden = serializer.validated_data["is_hidden"]
        comment.save(update_fields=["is_hidden", "updated_at"])
        message = (
            "Comment hidden successfully" if comment.is_hidden else "Comment unhidden successfully"
        )
        return success_response(CommentSerializer(comment).data, message=message)


class AdminCommentListView(ListQueryMixin, ListAPIView):
    """Staff-only cross-game comment queue (Phase E).

    Game pages only show their own comments; this is the moderation view over
    every comment, searchable by content, game, or author, with the same
    ``?is_hidden=`` narrowing as the per-review list.
    """

    queryset = Comment.objects.select_related("user", "review", "review__game")
    serializer_class = AdminCommentSerializer
    permission_classes = [IsAdmin]
    success_message = "Comments retrieved successfully"
    search_fields = [
        "content",
        "review__game__name",
        "user__email",
        "user__first_name",
        "user__last_name",
    ]
    ordering_fields = ["created_at"]
    ordering = "-created_at"

    def get_queryset(self):
        queryset = super().get_queryset()
        raw = self.request.query_params.get("is_hidden")
        if raw is not None:
            return apply_hidden_filter(queryset, raw)
        return queryset
