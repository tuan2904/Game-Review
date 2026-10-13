from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAdmin(BasePermission):
    """Allow access only to admin users (``is_staff``)."""

    message = "Admin privileges required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_staff)


class IsAdminOrReadOnly(BasePermission):
    """Safe (read) methods are public; writes require an admin (``is_staff``).

    Composes :class:`IsAdmin` — anonymous writes get 401, authenticated
    non-admin writes get 403.
    """

    message = "Admin privileges required."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return IsAdmin().has_permission(request, view)


class IsOwner(BasePermission):
    """Allow access only to the owner of a resource.

    Ownership convention: the resource exposes its owner as ``obj.user``
    (Review, Comment, Favorite all follow this).
    """

    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        return getattr(obj, "user", None) == request.user


class IsAdminOrOwner(BasePermission):
    """Allow admins, or the owner of the resource."""

    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_staff:
            return True
        return getattr(obj, "user", None) == user
