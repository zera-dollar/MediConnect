import json
import urllib.error
import urllib.request

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from hospitals.models import Hospital, HospitalStaff
from resources.models import (
    HospitalResource,
    OxygenSupply,
    ResourceTransaction,
)
from .models import InboundSMS, OfflineResourceUpdate


class SMSGatewayNotConfigured(Exception):
    pass


class SMSGatewayError(Exception):
    pass


def send_sms(recipient, message):
    if not settings.SMS_GATEWAY_URL or not settings.SMS_GATEWAY_TOKEN:
        raise SMSGatewayNotConfigured('SMS gateway URL and token are not configured.')
    payload = json.dumps({'to': recipient, 'message': message}).encode('utf-8')
    request = urllib.request.Request(
        settings.SMS_GATEWAY_URL,
        data=payload,
        headers={
            'Authorization': f'Bearer {settings.SMS_GATEWAY_TOKEN}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            response_data = json.loads(response.read().decode('utf-8'))
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise SMSGatewayError('Configured SMS gateway request failed.') from exc
    if not isinstance(response_data, dict):
        raise SMSGatewayError('Configured SMS gateway returned an invalid response.')
    provider_message_id = response_data.get('message_id')
    if not isinstance(provider_message_id, str) or not provider_message_id:
        raise SMSGatewayError('Configured SMS gateway returned no message_id.')
    return provider_message_id


def _process_inbound_resource_command(*, sender, message, provider_message_id, provider):
    sender = sender.strip()
    if not sender or not provider_message_id.strip():
        raise ValidationError('Sender and provider message ID are required.')
    parts = message.strip().split()
    command = parts[0].upper() if parts else 'UNKNOWN'
    if command not in {'BED', 'O2'}:
        command = 'UNKNOWN'

    with transaction.atomic():
        inbound, created = InboundSMS.objects.get_or_create(
            provider=provider,
            provider_message_id=provider_message_id,
            defaults={
                'sender': sender,
                'command': command,
                'status': InboundSMS.Status.PROCESSING,
            },
        )
        if not created:
            return inbound.status, inbound.response
        if len(parts) != 4 or command == 'UNKNOWN':
            return _save_rejection(inbound, 'Use BED or O2 facility-code resource-id quantity.')

        _, facility_code, record_id_raw, value_raw = parts
        try:
            record_id = int(record_id_raw)
            value = int(value_raw)
        except ValueError:
            return _save_rejection(inbound, 'Resource ID and quantity must be whole numbers.')
        if record_id < 1 or value < 0:
            return _save_rejection(inbound, 'Resource ID must be positive and quantity cannot be negative.')

        facility = Hospital.objects.filter(master_facility_code=facility_code).first()
        if facility is None:
            return _save_rejection(inbound, 'Unknown facility code.')
        normalized_sender = _normalize_phone(sender)
        staff = HospitalStaff.objects.filter(
            Q(user__phone=normalized_sender) | Q(user__phone=sender),
            hospital=facility,
            user__is_active=True,
            is_active=True,
            role_at_hospital__in=['ADMIN', 'MANAGER', 'COORDINATOR'],
        ).select_related('user').first()
        if staff is None:
            return _save_rejection(inbound, 'Sender is not an authorized facility manager.')

        if command == 'BED':
            return _update_bed_count(
                inbound=inbound,
                facility=facility,
                staff=staff,
                resource_id=record_id,
                value=value,
            )
        return _update_oxygen_count(
            inbound=inbound,
            command=command,
            facility=facility,
            staff=staff,
            supply_id=record_id,
            value=value,
        )


def process_inbound_sms(*, sender, message, provider_message_id):
    return _process_inbound_resource_command(
        sender=sender,
        message=message,
        provider_message_id=provider_message_id,
        provider='generic',
    )


def process_inbound_ussd(*, sender, message, session_id):
    return _process_inbound_resource_command(
        sender=sender,
        message=message,
        provider_message_id=session_id,
        provider='ussd',
    )


def _normalize_phone(phone):
    digits = ''.join(character for character in phone if character.isdigit())
    if digits.startswith('0') and len(digits) == 10:
        return f'+254{digits[1:]}'
    if digits.startswith('254') and len(digits) == 12:
        return f'+{digits}'
    return f'+{digits}' if digits else phone


def _save_rejection(inbound, message):
    inbound.status = InboundSMS.Status.REJECTED
    inbound.response = message
    inbound.save(update_fields=['status', 'response'])
    return InboundSMS.Status.REJECTED, message


def _update_bed_count(*, inbound, facility, staff, resource_id, value):
    try:
        resource = HospitalResource.objects.select_for_update().select_related(
            'resource_type',
        ).get(
            pk=resource_id,
            hospital=facility,
            resource_type__category__name__iexact='Beds',
        )
    except HospitalResource.DoesNotExist:
        return _save_rejection(inbound, 'Bed resource does not belong to this facility.')

    previous = resource.available_quantity
    if value > resource.total_capacity:
        return _save_rejection(inbound, 'Quantity exceeds configured capacity.')
    resource.available_quantity = value
    resource.updated_by = staff.user
    resource.save(update_fields=['available_quantity', 'updated_by', 'last_updated'])
    ResourceTransaction.objects.create(
        hospital_resource=resource,
        transaction_type=ResourceTransaction.TransactionType.ADJUST,
        quantity=value - previous,
        previous_available=previous,
        new_available=value,
        performed_by=staff.user,
        reason='Authorized SMS resource count update',
        reference=inbound.provider_message_id,
    )
    return _save_success(inbound, f'{resource.resource_type.name} availability updated to {value}.')


def _update_oxygen_count(*, inbound, command, facility, staff, supply_id, value):
    try:
        supply = OxygenSupply.objects.select_for_update().get(pk=supply_id, hospital=facility)
    except OxygenSupply.DoesNotExist:
        return _save_rejection(inbound, 'Oxygen supply does not belong to this facility.')
    if value > supply.number_of_units:
        return _save_rejection(inbound, 'Quantity exceeds configured unit count.')
    supply.available_units = value
    supply.updated_by = staff.user
    supply.save(update_fields=['available_units', 'updated_by', 'last_updated'])
    return _save_success(inbound, f'Oxygen available units updated to {value}.')


def _save_success(inbound, message):
    inbound.status = InboundSMS.Status.PROCESSED
    inbound.response = message
    inbound.save(update_fields=['status', 'response'])
    return InboundSMS.Status.PROCESSED, message


def apply_offline_resource_update(*, user, validated_data):
    key = validated_data['idempotency_key']
    resource_id = validated_data['hospital_resource'].pk
    expected_last_updated = validated_data['expected_last_updated']
    available_quantity = validated_data['available_quantity']
    with transaction.atomic():
        update, created = OfflineResourceUpdate.objects.get_or_create(
            idempotency_key=key,
            defaults={
                'user': user,
                'hospital_resource_id': resource_id,
                'expected_last_updated': expected_last_updated,
                'available_quantity': available_quantity,
            },
        )
        if not created:
            if (
                update.user_id != user.pk
                or update.hospital_resource_id != resource_id
                or update.expected_last_updated != expected_last_updated
                or update.available_quantity != available_quantity
            ):
                raise ValidationError({'idempotency_key': 'This key was already used for a different update.'})
            return update

        resource = HospitalResource.objects.select_for_update().get(pk=resource_id)
        if resource.last_updated != expected_last_updated:
            update.status = OfflineResourceUpdate.Status.CONFLICT
            update.detail = 'Resource data changed while this update was offline; review and resubmit.'
            update.save(update_fields=['status', 'detail'])
            return update
        if available_quantity > resource.total_capacity:
            update.status = OfflineResourceUpdate.Status.CONFLICT
            update.detail = 'Available quantity exceeds the configured capacity.'
            update.save(update_fields=['status', 'detail'])
            return update

        previous = resource.available_quantity
        resource.available_quantity = available_quantity
        resource.updated_by = user
        resource.save(update_fields=['available_quantity', 'updated_by', 'last_updated'])
        ResourceTransaction.objects.create(
            hospital_resource=resource,
            transaction_type=ResourceTransaction.TransactionType.ADJUST,
            quantity=available_quantity - previous,
            previous_available=previous,
            new_available=available_quantity,
            performed_by=user,
            reason='Queued offline resource update',
            reference=str(key),
        )
        update.status = OfflineResourceUpdate.Status.APPLIED
        update.previous_available = previous
        update.applied_at = timezone.now()
        update.detail = 'Offline resource update applied.'
        update.save(update_fields=['status', 'previous_available', 'applied_at', 'detail'])
        return update
