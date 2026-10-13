from django.urls import path

from apps.favorites.views import GameFavoriteView, UserFavoriteListView

app_name = "favorites"

urlpatterns = [
    path(
        "games/<slug:slug>/favorite/",
        GameFavoriteView.as_view(),
        name="game-favorite",
    ),
    path("me/favorites/", UserFavoriteListView.as_view(), name="my-favorites"),
]
