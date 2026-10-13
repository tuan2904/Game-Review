from rest_framework.pagination import PageNumberPagination

from apps.common.responses import success_response


class DefaultPagination(PageNumberPagination):
    """Page-number pagination that returns the standard response envelope.

    Paginated response shape:

        {
            "success": true,
            "message": "Games retrieved successfully",
            "data": {
                "items": [...],
                "pagination": {"page": 1, "page_size": 12, "total": 30, "total_pages": 3}
            }
        }

    Views may set ``success_message`` to customize the envelope message.
    """

    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 100

    def paginate_queryset(self, queryset, request, view=None):
        self.view = view
        return super().paginate_queryset(queryset, request, view)

    def get_paginated_response(self, data):
        view = getattr(self, "view", None)
        message = getattr(view, "success_message", None) or "Request successful"
        return success_response(
            data={
                "items": data,
                "pagination": {
                    "page": self.page.number,
                    "page_size": self.get_page_size(self.request),
                    "total": self.page.paginator.count,
                    "total_pages": self.page.paginator.num_pages,
                },
            },
            message=message,
        )
