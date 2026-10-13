from rest_framework.response import Response


def success_body(data=None, message="Request successful"):
    return {
        "success": True,
        "message": message,
        "data": data if data is not None else {},
    }


def error_body(message="Request failed", errors=None):
    return {
        "success": False,
        "message": message,
        "errors": errors if errors is not None else {},
    }


def success_response(data=None, message="Request successful", status=200):
    return Response(success_body(data=data, message=message), status=status)


def error_response(message="Request failed", errors=None, status=400):
    return Response(error_body(message=message, errors=errors), status=status)
