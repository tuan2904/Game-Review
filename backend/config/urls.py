from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("apps.common.urls")),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.games.urls")),
    path("api/v1/", include("apps.reviews.urls")),
    path("api/v1/", include("apps.comments.urls")),
    path("api/v1/", include("apps.favorites.urls")),
    path("api/v1/", include("apps.reports.urls")),
]

handler404 = "apps.common.views.api_not_found"
handler500 = "apps.common.views.api_server_error"
