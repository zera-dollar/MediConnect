from django.conf import settings
from django.db import models


class DriverTelemetrySession(models.Model):
    ambulance_request = models.ForeignKey(
        'ambulances.AmbulanceRequest',
        on_delete=models.CASCADE,
        related_name='telemetry_sessions',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_telemetry_sessions',
    )
    link_token_hash = models.CharField(max_length=64, unique=True)
    access_token_hash = models.CharField(max_length=64, unique=True, null=True, blank=True)
    expires_at = models.DateTimeField()
    link_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['ambulance_request', 'expires_at']),
        ]

    def __str__(self):
        return f'Telemetry session for ambulance request {self.ambulance_request_id}'
