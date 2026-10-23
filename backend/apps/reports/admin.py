from django.contrib import admin

from apps.reports.models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("id", "reason", "status", "reporter", "target", "created_at")
    list_filter = ("status", "reason")
    search_fields = ("reporter__email", "review__content", "comment__content")
    readonly_fields = ("created_at", "updated_at", "resolved_at")

    @admin.display(description="Target")
    def target(self, obj):
        return f"{obj.target_type} #{obj.target_id}"
