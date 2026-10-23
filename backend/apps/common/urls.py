from django.urls import path

from apps.common.views import AdminSummaryView, HealthView

app_name = "common"

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("admin/summary/", AdminSummaryView.as_view(), name="admin-summary"),
]
