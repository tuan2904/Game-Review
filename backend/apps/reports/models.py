from django.conf import settings
from django.db import models

from apps.comments.models import Comment
from apps.reviews.models import Review


class Report(models.Model):
    """A signed-in user's report against a single review or comment (Phase E).

    Exactly one target is enforced at the database level: the CHECK constraint
    requires either ``review`` or ``comment`` to be set (never both, never
    neither). The conditional unique constraints let one account report the
    same piece of content only once — duplicates surface as a 409 Conflict
    rather than piling up identical rows. Deleting the reported content cascades
    its reports away (moderating away the report target resolves it too).
    """

    class Reason(models.TextChoices):
        SPAM = "SPAM", "Spam or advertising"
        HARASSMENT = "HARASSMENT", "Harassment or abuse"
        OFF_TOPIC = "OFF_TOPIC", "Off-topic"
        MISLEADING = "MISLEADING", "Misleading information"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        RESOLVED = "RESOLVED", "Resolved"

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reports",
    )
    review = models.ForeignKey(
        Review,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="reports",
    )
    comment = models.ForeignKey(
        Comment,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="reports",
    )
    reason = models.CharField(max_length=16, choices=Reason.choices)
    details = models.CharField(max_length=500, blank=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(review__isnull=False, comment__isnull=True)
                    | models.Q(review__isnull=True, comment__isnull=False)
                ),
                name="report_exactly_one_target",
            ),
            models.UniqueConstraint(
                fields=["reporter", "review"],
                condition=models.Q(review__isnull=False),
                name="report_unique_reporter_review",
            ),
            models.UniqueConstraint(
                fields=["reporter", "comment"],
                condition=models.Q(comment__isnull=False),
                name="report_unique_reporter_comment",
            ),
        ]

    @property
    def target_type(self) -> str:
        return "review" if self.review_id else "comment"

    @property
    def target_id(self) -> int:
        return self.review_id or self.comment_id

    def __str__(self) -> str:
        return f"Report #{self.pk} ({self.target_type} {self.target_id}) by {self.reporter_id}"
