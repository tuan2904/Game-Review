from django.urls import path

from apps.reports.views import (
    CommentReportView,
    ReportListView,
    ReportResolveView,
    ReviewReportView,
)

app_name = "reports"

urlpatterns = [
    path("reviews/<int:pk>/report/", ReviewReportView.as_view(), name="review-report"),
    path(
        "comments/<int:pk>/report/",
        CommentReportView.as_view(),
        name="comment-report",
    ),
    path("admin/reports/", ReportListView.as_view(), name="report-list"),
    path(
        "admin/reports/<int:pk>/resolve/",
        ReportResolveView.as_view(),
        name="report-resolve",
    ),
]
