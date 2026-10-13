import logging

from django.db import DatabaseError, connection
from django.http import JsonResponse
from django.views.defaults import page_not_found, server_error
from rest_framework.views import APIView

from apps.common.responses import error_body, error_response, success_response

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
