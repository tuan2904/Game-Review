from django.conf import settings
from django.db import models

from apps.games.models import Game


class Review(models.Model):
    game = models.ForeignKey(Game, on_delete=models.PROTECT, related_name="reviews")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="reviews"
    )
    rating = models.PositiveSmallIntegerField()
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "game"], name="unique_review_per_user_per_game"
            ),
            models.CheckConstraint(
                condition=models.Q(rating__gte=1, rating__lte=5),
                name="review_rating_range",
            ),
        ]

    def __str__(self):
        return f"{self.user} reviewed {self.game} ({self.rating})"
