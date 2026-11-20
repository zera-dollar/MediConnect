import logging

from celery import shared_task
from django.utils import timezone

from .models import OutboundSMS
from .services import SMSGatewayError, SMSGatewayNotConfigured, send_sms

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def send_outbound_sms(self, sms_id):
    try:
        message = OutboundSMS.objects.get(pk=sms_id)
    except OutboundSMS.DoesNotExist:
        logger.error('SMS outbox record %s does not exist.', sms_id)
        return 'missing'
    if message.status == OutboundSMS.Status.SENT:
        return 'sent'

    try:
        provider_id = send_sms(message.recipient, message.message)
    except SMSGatewayNotConfigured as exc:
        message.status = OutboundSMS.Status.PENDING_CONFIGURATION
        message.last_error = str(exc)
        message.save(update_fields=['status', 'last_error'])
        return 'pending_configuration'
    except SMSGatewayError as exc:
        message.status = OutboundSMS.Status.FAILED
        message.last_error = str(exc)
        message.save(update_fields=['status', 'last_error'])
        raise self.retry(exc=exc, countdown=30)

    message.status = OutboundSMS.Status.SENT
    message.provider_message_id = provider_id
    message.sent_at = timezone.now()
    message.last_error = ''
    message.save(update_fields=['status', 'provider_message_id', 'sent_at', 'last_error'])
    return 'sent'
