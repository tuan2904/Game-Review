from django.conf import settings
from django.db import models

from apps.games.models import Game


class Favorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="favorites"
    )
    game = models.ForeignKey(Game, on_delete=models.PROTECT, related_name="favorites")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "game"], name="unique_favorite_per_user_per_game"
            ),
        ]

    def __str__(self):
        return f"{self.user} favorited {self.game}"
