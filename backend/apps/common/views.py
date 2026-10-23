import logging

from django.db import DatabaseError, connection
from django.db.models import Count, Q
from django.http import JsonResponse
from django.views.defaults import page_not_found, server_error
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.comments.models import Comment
from apps.common.permissions import IsAdmin
from apps.common.responses import error_body, error_response, success_response
from apps.favorites.models import Favorite
from apps.games.models import Category, Game
from apps.reports.models import Report
from apps.reviews.models import Review

logger = logging.getLogger(__name__)

API_PATH_PREFIX = "/api/"


class HealthView(APIView):
    """Lightweight availability check: application + database connectivity."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except DatabaseError:
            logger.error("Database health check failed")
            return error_response(message="Service unavailable", status=503)
        return success_response(
            data={"status": "ok", "database": "ok"}, message="Service is healthy"
        )


class AdminSummaryView(APIView):
    """Staff-only dashboard counters (Phase E).

    One request, one count-query per model (7 total) — the dashboard renders
    from a single payload instead of fanning out to six list endpoints. All
    counts are live (no cached/denormalized totals) and permission-checked by
    ``IsAdmin``, so locked or anonymous users get 401/403 here.
    """

    permission_classes = [IsAdmin]

    def get(self, request):
        games = Game.objects.aggregate(
            total=Count("pk"),
            active=Count("pk", filter=Q(status=Game.Status.ACTIVE)),
        )
        users = User.objects.aggregate(
            total=Count("pk"),
            active=Count("pk", filter=Q(is_active=True)),
            staff=Count("pk", filter=Q(is_staff=True)),
        )
        comments = Comment.objects.aggregate(
            total=Count("pk"),
            hidden=Count("pk", filter=Q(is_hidden=True)),
        )
        reports = Report.objects.aggregate(
            total=Count("pk"),
            pending=Count("pk", filter=Q(status=Report.Status.PENDING)),
        )
        data = {
            "games": {
                "total": games["total"],
                "active": games["active"],
                "inactive": games["total"] - games["active"],
            },
            "categories": Category.objects.count(),
            "users": {
                "total": users["total"],
                "active": users["active"],
                "locked": users["total"] - users["active"],
                "staff": users["staff"],
            },
            "reviews": Review.objects.count(),
            "comments": {
                "total": comments["total"],
                "visible": comments["total"] - comments["hidden"],
                "hidden": comments["hidden"],
            },
            "favorites": Favorite.objects.count(),
            "reports": {
                "total": reports["total"],
                "pending": reports["pending"],
                "resolved": reports["total"] - reports["pending"],
            },
        }
        return success_response(data, message="Summary retrieved successfully")


def api_not_found(request, exception=None):
    """JSON 404 for unknown API URLs; standard Django HTML for everything else."""
    if request.path.startswith(API_PATH_PREFIX):
        return JsonResponse(error_body(message="Not found"), status=404)
    return page_not_found(request, exception)


def api_server_error(request):
    """Generic JSON 500 for API URLs; details are logged, never returned."""
    if request.path.startswith(API_PATH_PREFIX):
        logger.error("Unhandled server error on %s", request.path)
        return JsonResponse(error_body(message="Internal server error"), status=500)
    return server_error(request)
