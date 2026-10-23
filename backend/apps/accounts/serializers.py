from django.contrib.auth.password_validation import validate_password
from django.db import IntegrityError
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User

EMAIL_TAKEN_MESSAGE = "A user with this email already exists."
INVALID_CREDENTIALS_MESSAGE = "Invalid email or password"


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "first_name", "last_name", "is_staff")
        read_only_fields = ("id", "email", "is_staff")


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """Self-service profile update — only non-sensitive display fields.

    Exposes ``first_name``/``last_name`` exclusively, so a crafted payload can
    never change ``email``, ``is_staff``, ``is_superuser`` or ``is_active``
    (privilege-escalation / account-takeover guard).
    """

    class Meta:
        model = User
        fields = ("first_name", "last_name")


class AdminUserSerializer(serializers.ModelSerializer):
    """Safe user representation for the staff user list — no password/perms."""

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "is_staff",
            "is_active",
            "created_at",
        )
        read_only_fields = fields


class AdminUserStatusSerializer(serializers.Serializer):
    """Staff-only payload for lock/unlock (``is_active``)."""

    is_active = serializers.BooleanField()


class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True, max_length=128, validators=[validate_password]
    )

    class Meta:
        model = User
        fields = ("id", "email", "password", "first_name", "last_name")
        read_only_fields = ("id",)

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(EMAIL_TAKEN_MESSAGE)
        return email

    def create(self, validated_data):
        try:
            return User.objects.create_user(**validated_data)
        except IntegrityError:
            raise serializers.ValidationError({"email": [EMAIL_TAKEN_MESSAGE]}) from None


class LoginSerializer(TokenObtainPairSerializer):
    """Email/password login; keeps SimpleJWT token issuing, adds safe user data."""

    default_error_messages = {"no_active_account": _(INVALID_CREDENTIALS_MESSAGE)}

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()

    def validate(self, attrs):
        try:
            RefreshToken(attrs["refresh"]).blacklist()
        except TokenError as exc:
            raise InvalidToken(str(exc)) from exc
        return attrs
