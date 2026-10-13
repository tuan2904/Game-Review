from django.db.models import ProtectedError
from rest_framework.generics import GenericAPIView, ListCreateAPIView, RetrieveAPIView
from rest_framework.mixins import DestroyModelMixin, UpdateModelMixin

from apps.common.exceptions import ConflictException
from apps.common.filters import ListQueryMixin
from apps.common.permissions import IsAdminOrReadOnly
from apps.common.responses import success_response
from apps.games.models import Category, Game
from apps.games.serializers import CategorySerializer, GameSerializer


class GameListCreateView(ListQueryMixin, ListCreateAPIView):
    queryset = Game.objects.select_related("category")
    serializer_class = GameSerializer
    permission_classes = [IsAdminOrReadOnly]
    success_message = "Games retrieved successfully"
    search_fields = ["name", "description", "developer", "publisher"]
    ordering_fields = ["name", "release_date", "created_at"]
    ordering = "-created_at"
    filter_fields = {"category": "category__slug", "status": "status"}

    def get_queryset(self):
        return self.apply_filters(
            Game.objects.visible_to(self.request.user).select_related("category")
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return success_response(serializer.data, message="Game created successfully", status=201)


class GameDetailView(RetrieveAPIView):
    queryset = Game.objects.select_related("category")
    serializer_class = GameSerializer
    permission_classes = [IsAdminOrReadOnly]
    lookup_field = "slug"

    def get_queryset(self):
        return Game.objects.visible_to(self.request.user).select_related("category")

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return success_response(
            self.get_serializer(instance).data, message="Game retrieved successfully"
        )


class GameUpdateDestroyView(UpdateModelMixin, DestroyModelMixin, GenericAPIView):
    queryset = Game.objects.select_related("category")
    serializer_class = GameSerializer
    permission_classes = [IsAdminOrReadOnly]

    def patch(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    def delete(self, request, *args, **kwargs):
        return self.destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return success_response(serializer.data, message="Game updated successfully")

    def destroy(self, request, *args, **kwargs):
        try:
            self.perform_destroy(self.get_object())
        except ProtectedError:
            raise ConflictException("Cannot delete game while reviews reference it.") from None
        return success_response(message="Game deleted successfully")


class CategoryListCreateView(ListCreateAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    success_message = "Categories retrieved successfully"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return success_response(
            serializer.data, message="Category created successfully", status=201
        )


class CategoryUpdateDestroyView(UpdateModelMixin, DestroyModelMixin, GenericAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]

    def patch(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    def delete(self, request, *args, **kwargs):
        return self.destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return success_response(serializer.data, message="Category updated successfully")

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except ProtectedError:
            raise ConflictException("Cannot delete category while games reference it.") from None
        return success_response(message="Category deleted successfully")
