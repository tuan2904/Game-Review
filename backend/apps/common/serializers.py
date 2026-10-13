from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class SafeUserSerializer(serializers.ModelSerializer):
    """Safe author fields shared by Review and Comment: never exposes email,
    password hashes, or tokens."""

    class Meta:
        model = User
        fields = ("id", "first_name", "last_name")
