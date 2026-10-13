from django.shortcuts import get_object_or_404
from rest_framework.generics import GenericAPIView, ListCreateAPIView
from rest_framework.mixins import DestroyModelMixin, UpdateModelMixin

from apps.comments.models import Comment
from apps.comments.serializers import CommentSerializer
from apps.common.permissions import IsAdminOrOwner
from apps.common.responses import success_response
from apps.games.models import Game
from apps.reviews.models import Review


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
        return self.queryset.filter(review=self.get_review()).order_by("-created_at")

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
