import hmac
import logging

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from hospitals.models import HospitalStaff
from .models import OfflineResourceUpdate
from .serializers import InboundSMSSerializer, InboundUSSDSerializer, OfflineResourceUpdateSerializer
from .services import apply_offline_resource_update, process_inbound_sms, process_inbound_ussd

logger = logging.getLogger(__name__)


@extend_schema(tags=['SMS integration'])
class InboundSMSView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        configured_token = settings.SMS_WEBHOOK_TOKEN
        supplied_token = request.headers.get('X-Webhook-Token', '')
        if not configured_token:
            return Response(
                {'detail': 'Inbound SMS is not configured.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not hmac.compare_digest(supplied_token, configured_token):
            return Response({'detail': 'Invalid webhook token.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = InboundSMSSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        result_status, detail = process_inbound_sms(
            sender=data['sender'],
            message=data['message'],
            provider_message_id=data['provider_message_id'],
        )
        if result_status == 'REJECTED':
            logger.warning(
                'Rejected inbound SMS provider message %s: %s',
                serializer.validated_data['provider_message_id'],
                detail,
            )
        return Response({'status': result_status.lower(), 'detail': detail})


@extend_schema(tags=['USSD integration'])
class InboundUSSDView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        configured_token = settings.USSD_WEBHOOK_TOKEN
        supplied_token = request.headers.get('X-Webhook-Token', '')
        if not configured_token:
            return Response(
                {'detail': 'Inbound USSD is not configured.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not hmac.compare_digest(supplied_token, configured_token):
            return Response({'detail': 'Invalid webhook token.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = InboundUSSDSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        result_status, detail = process_inbound_ussd(
            sender=data['sender'],
            message=data['message'],
            session_id=data['session_id'],
        )
        if result_status == 'REJECTED':
            logger.warning(
                'Rejected inbound USSD session %s: %s',
                serializer.validated_data['session_id'],
                detail,
            )
        return Response({'action': 'END', 'status': result_status.lower(), 'message': detail})


@extend_schema(tags=['Offline sync'])
class OfflineResourceUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = OfflineResourceUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resource = serializer.validated_data['hospital_resource']
        user = request.user
        if not (user.is_superuser or user.role == 'ADMIN') and not HospitalStaff.objects.filter(
            user=user,
            hospital=resource.hospital,
            is_active=True,
            role_at_hospital__in=['ADMIN', 'MANAGER', 'COORDINATOR'],
        ).exists():
            raise PermissionDenied('You are not authorized to update this hospital resource.')

        update = apply_offline_resource_update(user=user, validated_data=serializer.validated_data)
        response_status = (
            status.HTTP_409_CONFLICT
            if update.status == OfflineResourceUpdate.Status.CONFLICT
            else status.HTTP_200_OK
        )
        return Response(OfflineResourceUpdateSerializer(update).data, status=response_status)
