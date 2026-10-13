from django.conf import settings
from django.db import models

from apps.reviews.models import Review


class Comment(models.Model):
    review = models.ForeignKey(Review, on_delete=models.PROTECT, related_name="comments")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="comments"
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(content__regex=r"^\s*$"),
                name="comment_content_not_blank",
            ),
        ]

    def __str__(self):
        return f"{self.user} commented on review {self.review_id}"
