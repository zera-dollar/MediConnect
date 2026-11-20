from django.contrib import admin

from .models import ActivityLedger


@admin.register(ActivityLedger)
class ActivityLedgerAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'event_type',
        'resource_type',
        'resource_id',
        'method',
        'response_status',
        'created_at',
    )
    list_filter = ('event_type', 'method', 'response_status')
    search_fields = ('user__email', 'resource_type', 'resource_id', 'endpoint')
    readonly_fields = (
        'user',
        'event_type',
        'resource_type',
        'resource_id',
        'method',
        'endpoint',
        'response_status',
        'created_at',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
