from django.contrib import admin

from .models import InboundSMS, OutboundSMS


@admin.register(InboundSMS)
class InboundSMSAdmin(admin.ModelAdmin):
    list_display = ('provider', 'provider_message_id', 'sender', 'command', 'status', 'received_at')
    readonly_fields = ('provider', 'provider_message_id', 'sender', 'command', 'status', 'response', 'received_at')


@admin.register(OutboundSMS)
class OutboundSMSAdmin(admin.ModelAdmin):
    list_display = ('recipient', 'status', 'created_at', 'sent_at')
    readonly_fields = ('recipient', 'message', 'status', 'provider_message_id', 'last_error', 'created_at', 'sent_at')
