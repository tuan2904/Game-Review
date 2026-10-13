from django.contrib.auth.forms import BaseUserCreationForm, UserChangeForm

from apps.accounts.models import User


class EmailUserCreationForm(BaseUserCreationForm):
    """Admin "add user" form driven by email instead of username."""

    class Meta:
        model = User
        fields = ("email",)

    def clean_email(self):
        return self.cleaned_data["email"].strip().lower()


class EmailUserChangeForm(UserChangeForm):
    """Admin change form for the email-based user model."""

    class Meta:
        model = User
        fields = "__all__"
