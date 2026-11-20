from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from contracts.models import Bid
from hospitals.models import HospitalStaff
from .models import OutboundSMS
from .tasks import send_outbound_sms


@receiver(post_save, sender=Bid)
def queue_urgent_bid_sms(sender, instance, created, **kwargs):
    if not created or instance.contract.urgency not in {'HIGH', 'CRITICAL'}:
        return

    hospital_staff = HospitalStaff.objects.filter(
        hospital=instance.contract.hospital,
        is_active=True,
        role_at_hospital__in=['ADMIN', 'MANAGER', 'COORDINATOR'],
        user__is_active=True,
    ).exclude(user__phone='').select_related('user')

    messages = [
        OutboundSMS(
            recipient=membership.user.phone,
            message=(
                f'Urgent bid received for contract {instance.contract_id}: '
                f'{instance.proposed_rate} {instance.currency}. Sign in to review.'
            ),
        )
        for membership in hospital_staff
    ]
    if not messages:
        return

    def enqueue():
        for sms in OutboundSMS.objects.bulk_create(messages):
            send_outbound_sms.delay(sms.pk)

    transaction.on_commit(enqueue)
