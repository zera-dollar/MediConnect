from celery import shared_task
from django.db import transaction
from django.utils import timezone

from .models import HospitalResource, HospitalResourceSnapshot


@shared_task(name='resources.tasks.snapshot_hospital_resources')
def snapshot_hospital_resources():
    """Record each active resource once in the current UTC hour bucket."""
    recorded_at = timezone.now().replace(minute=0, second=0, microsecond=0)
    resources = HospitalResource.objects.filter(is_active=True).only(
        'id',
        'available_quantity',
        'total_capacity',
        'reserved_quantity',
    )

    with transaction.atomic():
        snapshot_count = 0
        for resource in resources.iterator():
            HospitalResourceSnapshot.objects.update_or_create(
                hospital_resource_id_at_capture=resource.pk,
                recorded_at=recorded_at,
                defaults={
                    'hospital_resource': resource,
                    'available_quantity': resource.available_quantity,
                    'total_capacity': resource.total_capacity,
                    'reserved_quantity': resource.reserved_quantity,
                },
            )
            snapshot_count += 1

    return snapshot_count
