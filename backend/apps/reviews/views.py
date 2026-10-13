from django.shortcuts import get_object_or_404
from rest_framework.generics import GenericAPIView, ListCreateAPIView
from rest_framework.mixins import DestroyModelMixin, UpdateModelMixin

from apps.common.permissions import IsAdminOrOwner
from apps.common.responses import success_response
from apps.games.models import Game
from apps.reviews.models import Review
from apps.reviews.serializers import ReviewSerializer


class GameReviewListCreateView(ListCreateAPIView):
    serializer_class = ReviewSerializer
    success_message = "Reviews retrieved successfully"
    queryset = Review.objects.select_related("game", "user")

    def get_game(self):
        return get_object_or_404(
            Game.objects.visible_to(self.request.user),
            slug=self.kwargs["slug"],
        )

    def get_queryset(self):
        return self.queryset.filter(game=self.get_game()).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, game=self.get_game())

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return success_response(serializer.data, message="Review created successfully", status=201)


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
