import logging

from rest_framework.views import exception_handler

from apps.common.responses import error_response

logger = logging.getLogger(__name__)


class AppException(Exception):
    """Base class for expected application errors handled by the global exception handler."""

    status_code = 400
    default_message = "Request failed"

    def __init__(self, message=None, errors=None):
        message = message or self.default_message
        super().__init__(message)
        self.message = message
        self.errors = errors or {}


class BusinessException(AppException):
    """A business rule was violated (e.g. one review per user per game)."""

    default_message = "Business rule violated"


class ResourceNotFoundException(AppException):
    status_code = 404
    default_message = "Resource not found"


class ConflictException(AppException):
    status_code = 409
    default_message = "Resource already exists"


class PermissionException(AppException):
    status_code = 403
    default_message = "You do not have permission to perform this action"


def api_exception_handler(exc, context):
    """Convert every API exception into the standard error envelope.

    Never exposes stack traces, SQL, or internal details to clients.
    """
    if isinstance(exc, AppException):
        return error_response(message=exc.message, errors=exc.errors, status=exc.status_code)

    response = exception_handler(exc, context)

    if response is None:
        logger.exception("Unhandled API exception")
        return error_response(message="Internal server error", status=500)

    data = response.data
    if isinstance(data, dict):
        if "detail" in data:
            message = str(data["detail"])
            errors = {}
        else:
            message = "Validation failed"
            errors = data
    else:
        message = "Validation failed" if response.status_code == 400 else "Request failed"
        errors = {"non_field_errors": data}

    envelope = error_response(message=message, errors=errors, status=response.status_code)
    for header, value in response.headers.items():
        if header.lower() != "content-type":
            envelope[header] = value
    return envelope
