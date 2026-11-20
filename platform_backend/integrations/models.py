import uuid

from django.conf import settings
from django.db import models


class InboundSMS(models.Model):
    class Status(models.TextChoices):
        PROCESSING = 'PROCESSING', 'Processing'
        PROCESSED = 'PROCESSED', 'Processed'
        REJECTED = 'REJECTED', 'Rejected'

    provider = models.CharField(max_length=50, default='generic')
    provider_message_id = models.CharField(max_length=150)
    sender = models.CharField(max_length=30)
    command = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices)
    response = models.CharField(max_length=255, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['provider', 'provider_message_id'],
                name='unique_inbound_sms_provider_message',
            ),
        ]
        ordering = ['-received_at']

    def __str__(self):
        return f'{self.provider} SMS {self.provider_message_id} ({self.status})'


class OutboundSMS(models.Model):
    class Status(models.TextChoices):
        QUEUED = 'QUEUED', 'Queued'
        SENT = 'SENT', 'Sent'
        PENDING_CONFIGURATION = 'PENDING_CONFIGURATION', 'Pending gateway configuration'
        FAILED = 'FAILED', 'Failed'

    recipient = models.CharField(max_length=30)
    message = models.CharField(max_length=500)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.QUEUED)
    provider_message_id = models.CharField(max_length=150, blank=True)
    last_error = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'SMS to {self.recipient} ({self.status})'


class OfflineResourceUpdate(models.Model):
    class Status(models.TextChoices):
        PROCESSING = 'PROCESSING', 'Processing'
        APPLIED = 'APPLIED', 'Applied'
        CONFLICT = 'CONFLICT', 'Conflict'

    idempotency_key = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    hospital_resource = models.ForeignKey(
        'resources.HospitalResource',
        on_delete=models.CASCADE,
        related_name='offline_updates',
    )
    expected_last_updated = models.DateTimeField()
    available_quantity = models.PositiveIntegerField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PROCESSING)
    previous_available = models.PositiveIntegerField(null=True, blank=True)
    detail = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    applied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'Offline resource update {self.idempotency_key} ({self.status})'
