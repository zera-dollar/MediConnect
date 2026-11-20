from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class ActivityLedger(models.Model):
    class EventType(models.TextChoices):
        LOGIN = 'LOGIN', _('Signed in')
        REGISTER = 'REGISTER', _('Account registered')
        CREATE = 'CREATE', _('Created')
        UPDATE = 'UPDATE', _('Updated')
        DELETE = 'DELETE', _('Deleted')

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='activity_ledger_entries',
    )
    event_type = models.CharField(max_length=20, choices=EventType.choices)
    resource_type = models.CharField(max_length=100)
    resource_id = models.CharField(max_length=64, blank=True)
    method = models.CharField(max_length=10)
    endpoint = models.CharField(max_length=255)
    response_status = models.PositiveSmallIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['event_type', '-created_at']),
        ]

    def __str__(self):
        return f'{self.user_id}: {self.event_type} {self.resource_type}'
