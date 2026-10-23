from django.conf import settings
from django.db import models
from django.db.models.functions import Length

from apps.comments.constants import COMMENT_MAX_LENGTH
from apps.reviews.models import Review

# TextField does not ship a `length` lookup; register the built-in Length
# transform so the max-length check constraint below (and queries) can use it.
models.TextField.register_lookup(Length)


class Comment(models.Model):
    review = models.ForeignKey(Review, on_delete=models.PROTECT, related_name="comments")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="comments"
    )
    content = models.TextField(max_length=COMMENT_MAX_LENGTH)
    # Soft moderation flag: hidden comments are filtered out of public lists and
    # never returned to non-staff (see CommentListCreateView.get_queryset).
    is_hidden = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(content__regex=r"^\s*$"),
                name="comment_content_not_blank",
            ),
            models.CheckConstraint(
                condition=models.Q(content__length__lte=COMMENT_MAX_LENGTH),
                name="comment_content_max_length",
            ),
        ]

    def __str__(self):
        return f"{self.user} commented on review {self.review_id}"
