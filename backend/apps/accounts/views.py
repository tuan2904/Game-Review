from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
)
from rest_framework_simplejwt.views import (
    TokenRefreshView as SimpleJwtTokenRefreshView,
)

from apps.accounts.serializers import (
    LoginSerializer,
    LogoutSerializer,
    RegisterSerializer,
    UserSerializer,
)
from apps.common.responses import success_response


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return success_response(
            UserSerializer(user).data, message="Registration successful", status=201
        )


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer

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
