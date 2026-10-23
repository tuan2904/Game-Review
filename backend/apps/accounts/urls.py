from django.urls import path

from apps.accounts.views import (
    AdminUserListView,
    AdminUserStatusView,
    LoginView,
    LogoutView,
    MeView,
    RegisterView,
    TokenRefreshView,
)

app_name = "accounts"

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("admin/users/", AdminUserListView.as_view(), name="admin-user-list"),
    path(
        "admin/users/<int:pk>/status/",
        AdminUserStatusView.as_view(),
        name="admin-user-status",
    ),
]
