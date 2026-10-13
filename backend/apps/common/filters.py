from rest_framework.filters import OrderingFilter, SearchFilter


class ListQueryMixin:
    """Reusable search / ordering / field-filtering foundation for list endpoints.

    Configure on the view (mixin must come first in the bases)::

        class GameListView(ListQueryMixin, ListAPIView):
            queryset = Game.objects.all()
            serializer_class = GameSerializer
            search_fields = ["name", "developer"]      # ?search=elden
            ordering_fields = ["name", "release_date"] # allowlist for ?ordering=
            ordering = "-created_at"                   # default sort for stable pagination
            filter_fields = {"category": "category__slug"}  # ?category=rpg

    Search and ordering are delegated to DRF's SearchFilter / OrderingFilter.
    ``filter_fields`` maps an allowlisted query parameter to a Django ORM lookup
    so unknown parameters are never applied to queries.
    """

    filter_backends = [SearchFilter, OrderingFilter]
    filter_fields: dict[str, str] = {}
    search_fields: list[str] = []
    ordering_fields: list[str] = []
    ordering: str | None = None

    def get_queryset(self):
        return self.apply_filters(super().get_queryset())

    def apply_filters(self, queryset):
        for param, lookup in self.filter_fields.items():
            value = self.request.query_params.get(param)
            if value:
                queryset = queryset.filter(**{lookup: value})
        return queryset
