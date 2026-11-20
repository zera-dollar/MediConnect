from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _


class Appointment(models.Model):
    class Status(models.TextChoices):
        REQUESTED = 'REQUESTED', _('Requested')
        CONFIRMED = 'CONFIRMED', _('Confirmed')
        CANCELLED = 'CANCELLED', _('Cancelled')
        COMPLETED = 'COMPLETED', _('Completed')

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='appointments_as_patient',
    )
    professional = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='appointments_as_professional',
    )
    hospital = models.ForeignKey(
        'hospitals.Hospital',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='appointments',
    )
    patient_name = models.CharField(max_length=150)
    patient_email = models.EmailField(blank=True)
    patient_phone = models.CharField(max_length=20, blank=True)
    start_datetime = models.DateTimeField()
    duration_minutes = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(15), MaxValueValidator(480)],
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.REQUESTED,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['start_datetime']
        indexes = [
            models.Index(fields=['patient', 'start_datetime']),
            models.Index(fields=['professional', 'start_datetime']),
        ]

    def __str__(self):
        return f'Appointment for {self.patient_name} with {self.professional}'
