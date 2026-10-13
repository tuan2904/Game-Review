from django.urls import path

from apps.games.views import (
    CategoryListCreateView,
    CategoryUpdateDestroyView,
    GameDetailView,
    GameListCreateView,
    GameUpdateDestroyView,
)

app_name = "games"

urlpatterns = [
    path("games/", GameListCreateView.as_view(), name="game-list"),
    # Numeric id route first: pure-numeric slugs are rejected by the serializer,
    # so /games/<int:pk>/ unambiguously addresses admin PATCH/DELETE.
    path("games/<int:pk>/", GameUpdateDestroyView.as_view(), name="game-update"),
    path("games/<slug:slug>/", GameDetailView.as_view(), name="game-detail"),
    path("categories/", CategoryListCreateView.as_view(), name="category-list"),
    path(
        "categories/<int:pk>/",
        CategoryUpdateDestroyView.as_view(),
        name="category-update",
    ),
]
