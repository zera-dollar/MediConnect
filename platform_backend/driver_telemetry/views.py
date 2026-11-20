import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from ambulances.models import AmbulanceRequest
from hospitals.models import HospitalStaff
from .models import DriverTelemetrySession
from .serializers import CreateDriverSessionSerializer, ExchangeDriverLinkSerializer


def _token_hash(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def _can_dispatch(user, ambulance_request):
    if user.is_superuser or user.role == 'ADMIN':
        return True
    return HospitalStaff.objects.filter(
        user=user,
        hospital=ambulance_request.destination_hospital,
        is_active=True,
        role_at_hospital__in=['ADMIN', 'MANAGER', 'COORDINATOR'],
    ).exists()


@extend_schema(tags=['Driver telemetry'])
class DriverSessionCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CreateDriverSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            ambulance_request = AmbulanceRequest.objects.select_related(
                'destination_hospital',
            ).get(pk=serializer.validated_data['ambulance_request_id'])
        except AmbulanceRequest.DoesNotExist as exc:
            raise NotFound('Ambulance request was not found.') from exc

        if not _can_dispatch(request.user, ambulance_request):
            raise PermissionDenied('Only the destination hospital dispatch team can create a driver link.')
        if ambulance_request.status != AmbulanceRequest.Status.EN_ROUTE:
            return Response(
                {'detail': 'Driver links can be created only after dispatch begins.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        link_token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(hours=8)
        with transaction.atomic():
            DriverTelemetrySession.objects.filter(
                ambulance_request=ambulance_request,
                revoked_at__isnull=True,
                expires_at__gt=timezone.now(),
            ).update(revoked_at=timezone.now())
            DriverTelemetrySession.objects.create(
                ambulance_request=ambulance_request,
                created_by=request.user,
                link_token_hash=_token_hash(link_token),
                expires_at=expires_at,
            )

        return Response({
            'driver_url': f'{settings.FRONTEND_BASE_URL.rstrip("/")}/driver/{link_token}',
            'expires_at': expires_at,
            'detail': 'Share this single-use driver link only with the assigned driver.',
        }, status=status.HTTP_201_CREATED)


@extend_schema(tags=['Driver telemetry'])
class DriverLinkExchangeView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AnonRateThrottle]
    throttle_scope = 'driver_link_exchange'

    def post(self, request):
        serializer = ExchangeDriverLinkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        access_token = secrets.token_urlsafe(32)
        with transaction.atomic():
            try:
                session = DriverTelemetrySession.objects.select_for_update().get(
                    link_token_hash=_token_hash(serializer.validated_data['link_token']),
                    link_used_at__isnull=True,
                    revoked_at__isnull=True,
                    expires_at__gt=now,
                    ambulance_request__status=AmbulanceRequest.Status.EN_ROUTE,
                )
            except DriverTelemetrySession.DoesNotExist:
                return Response(
                    {'detail': 'This driver link is invalid, expired, or already used.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            session.link_used_at = now
            session.access_token_hash = _token_hash(access_token)
            session.save(update_fields=['link_used_at', 'access_token_hash'])

        return Response({
            'access_token': access_token,
            'expires_at': session.expires_at,
            'ambulance_request_id': session.ambulance_request_id,
        })
