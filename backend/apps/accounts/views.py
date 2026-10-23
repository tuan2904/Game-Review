from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
)
from rest_framework_simplejwt.views import (
    TokenRefreshView as SimpleJwtTokenRefreshView,
)

from apps.accounts.models import User
from apps.accounts.serializers import (
    AdminUserSerializer,
    AdminUserStatusSerializer,
    LoginSerializer,
    LogoutSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    UserSerializer,
)
from apps.accounts.throttles import LoginRateThrottle, RegisterRateThrottle
from apps.common.exceptions import BusinessException
from apps.common.filters import ListQueryMixin
from apps.common.permissions import IsAdmin
from apps.common.responses import success_response


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [RegisterRateThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return success_response(
            UserSerializer(user).data, message="Registration successful", status=201
        )


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_classes = [LoginRateThrottle]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(str(exc)) from exc
        return success_response(serializer.validated_data, message="Login successful")


class TokenRefreshView(SimpleJwtTokenRefreshView):
    def post(self, request, *args, **kwargs):
        # super().post converts TokenError (invalid/blacklisted refresh) to 401.
        response = super().post(request, *args, **kwargs)
        return success_response(response.data, message="Token refreshed successfully")


class LogoutView(APIView):
    """Blacklist the refresh token so it can never be used again."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return success_response(message="Logout successful")


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return success_response(
            UserSerializer(request.user).data, message="User retrieved successfully"
        )

    def patch(self, request):
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(
            UserSerializer(request.user).data, message="Profile updated successfully"
        )


class AdminUserListView(ListQueryMixin, ListAPIView):
    """Staff-only user directory (safe fields) with search + pagination."""

    queryset = User.objects.all()
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdmin]
    success_message = "Users retrieved successfully"
    search_fields = ["email", "first_name", "last_name"]
    ordering_fields = ["email", "first_name", "created_at"]
    ordering = "-created_at"


class AdminUserStatusView(GenericAPIView):
    """Staff-only lock/unlock of a user account (``is_active``).

    Locking is enforced by the JWT authentication class: a deactivated user is
    rejected (401) on every subsequent authenticated request, and login fails
    with the same generic 401.
    """

    queryset = User.objects.all()
    serializer_class = AdminUserStatusSerializer
    permission_classes = [IsAdmin]

    def post(self, request, *args, **kwargs):
        target = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        is_active = serializer.validated_data["is_active"]
        if target == request.user and not is_active:
            raise BusinessException("You cannot lock your own account.")
        target.is_active = is_active
        target.save(update_fields=["is_active", "updated_at"])
        message = "User unlocked successfully" if is_active else "User locked successfully"
        return success_response(AdminUserSerializer(target).data, message=message)
