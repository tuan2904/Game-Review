from django.urls import path

from apps.comments.views import (
    AdminCommentListView,
    CommentListCreateView,
    CommentModerationView,
    CommentUpdateDestroyView,
)

app_name = "comments"

urlpatterns = [
    path("admin/comments/", AdminCommentListView.as_view(), name="admin-comment-list"),
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
    path(
        "comments/<int:pk>/moderate/",
        CommentModerationView.as_view(),
        name="comment-moderate",
    ),
]
