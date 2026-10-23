from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.comments.models import Comment
from apps.common.exceptions import ConflictException
from apps.common.filters import ListQueryMixin
from apps.common.permissions import IsAdmin
from apps.common.responses import success_response
from apps.games.models import Game
from apps.reports.models import Report
from apps.reports.serializers import ReportCreateSerializer, ReportSerializer
from apps.reviews.models import Review

# Shared eager-loading for the report payload's nested reporter / targets
# (list + detail responses).
REPORT_SELECT_RELATED = (
    "reporter",
    "resolved_by",
    "review",
    "review__game",
    "comment",
    "comment__review",
    "comment__review__game",
)


def _submit_report(request, *, review=None, comment=None):
    """Validate the body, persist the report, and map duplicates to 409.

    The target comes from the URL (already visibility-checked by the caller),
    never from the payload — a crafted body cannot redirect the report.
    """
    serializer = ReportCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        with transaction.atomic():
            report = Report.objects.create(
                reporter=request.user,
                review=review,
                comment=comment,
                **serializer.validated_data,
            )
    except IntegrityError:
        # Conditional unique constraint: this account already reported this
        # exact target (the CHECK on one target is satisfied by the view).
        raise ConflictException("You have already reported this content.") from None
    return success_response(
        ReportSerializer(report).data,
        message="Report submitted successfully",
        status=201,
    )


class ReviewReportView(APIView):
    """POST /reviews/{id}/report/ — flag a review (authenticated users)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        review = get_object_or_404(
            Review.objects.select_related("game"),
            pk=pk,
            game__in=Game.objects.visible_to(request.user),
        )
        return _submit_report(request, review=review)


class CommentReportView(APIView):
    """POST /comments/{id}/report/ — flag a comment (authenticated users).

    Follows comment visibility: hidden comments are invisible on the game
    page, so they are 404 here for ordinary users (staff may still report
    them, mirroring the per-review comment list rules).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        queryset = Comment.objects.select_related("review", "review__game")
        if not request.user.is_staff:
            queryset = queryset.filter(is_hidden=False)
        comment = get_object_or_404(
            queryset,
            pk=pk,
            review__game__in=Game.objects.visible_to(request.user),
        )
        return _submit_report(request, comment=comment)


class ReportListView(ListQueryMixin, ListAPIView):
    """Staff-only moderation queue: reports with their nested content."""

    queryset = Report.objects.select_related(*REPORT_SELECT_RELATED)
    serializer_class = ReportSerializer
    permission_classes = [IsAdmin]
    success_message = "Reports retrieved successfully"
    search_fields = [
        "reporter__email",
        "reporter__first_name",
        "reporter__last_name",
        "review__content",
        "comment__content",
    ]
    ordering_fields = ["created_at", "status"]
    ordering = "-created_at"
    filter_fields = {"status": "status"}


class ReportResolveView(APIView):
    """Staff-only resolve of a pending report (idempotent → 409 on repeats)."""

    permission_classes = [IsAdmin]

    def post(self, request, pk):
        report = get_object_or_404(Report.objects.select_related(*REPORT_SELECT_RELATED), pk=pk)
        if report.status == Report.Status.RESOLVED:
            raise ConflictException("Report is already resolved.")
        report.status = Report.Status.RESOLVED
        report.resolved_by = request.user
        report.resolved_at = timezone.now()
        report.save(update_fields=["status", "resolved_by", "resolved_at", "updated_at"])
        return success_response(
            ReportSerializer(report).data, message="Report resolved successfully"
        )
