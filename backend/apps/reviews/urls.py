from django.urls import path

from apps.reviews.views import GameReviewListCreateView, ReviewUpdateDestroyView

app_name = "reviews"

urlpatterns = [
    path(
        "games/<slug:slug>/reviews/",
        GameReviewListCreateView.as_view(),
        name="game-review-list",
    ),
    path("reviews/<int:pk>/", ReviewUpdateDestroyView.as_view(), name="review-update"),
]
