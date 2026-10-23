from django.contrib import admin

from apps.comments.models import Comment


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("id", "review", "user", "is_hidden", "created_at")
    list_filter = ("is_hidden", "created_at")
    search_fields = ("content", "user__email")
    readonly_fields = ("created_at", "updated_at")
    actions = ("hide_comments", "unhide_comments")

    @admin.action(description="Hide selected comments")
    def hide_comments(self, request, queryset):
        updated = queryset.update(is_hidden=True)
        self.message_user(request, f"{updated} comment(s) hidden.")

    @admin.action(description="Unhide selected comments")
    def unhide_comments(self, request, queryset):
        updated = queryset.update(is_hidden=False)
        self.message_user(request, f"{updated} comment(s) unhidden.")
