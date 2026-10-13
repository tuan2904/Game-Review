from django.shortcuts import get_object_or_404
from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework.permissions import IsAuthenticated

from apps.common.responses import success_response
from apps.favorites.models import Favorite
from apps.favorites.serializers import FavoriteSerializer
from apps.games.models import Game


class GameFavoriteView(GenericAPIView):
    """POST/DELETE the current user's favorite for one game."""

    queryset = Favorite.objects.select_related("game", "game__category")
    serializer_class = FavoriteSerializer

    def get_game(self):
        # Same visibility rule as the Game module: unknown or inactive
        # (non-staff) slug → 404.
        return get_object_or_404(
            Game.objects.visible_to(self.request.user), slug=self.kwargs["slug"]
        )

    def post(self, request, *args, **kwargs):
        game = self.get_game()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Identity and game come from the token/URL — any client-supplied
        # user/game ids in the payload are ignored.
        favorite = serializer.save(user=request.user, game=game)
        return success_response(
            self.get_serializer(favorite).data,
            message="Favorite added successfully",
            status=201,
        )

    def delete(self, request, *args, **kwargs):
        game = self.get_game()
        # Scoped to request.user: another user's favorite is never touched.
        # Idempotent — deleting a missing favorite still returns 200.
        Favorite.objects.filter(user=request.user, game=game).delete()
        return success_response(message="Favorite removed successfully")


class UserFavoriteListView(ListAPIView):
    serializer_class = FavoriteSerializer
    permission_classes = [IsAuthenticated]
    success_message = "Favorites retrieved successfully"

    def get_queryset(self):
        user = self.request.user
        return (
            Favorite.objects.filter(user=user, game__in=Game.objects.visible_to(user))
            .select_related("game", "game__category")
            .order_by("-created_at")
        )
