from django.urls import path

from apps.comments.views import CommentListCreateView, CommentUpdateDestroyView

app_name = "comments"

urlpatterns = [
    path(
        "reviews/<int:review_id>/comments/",
        CommentListCreateView.as_view(),
        name="review-comment-list",
    ),
    path(
        "comments/<int:pk>/",
        CommentUpdateDestroyView.as_view(),
        name="comment-update",
    ),
]
