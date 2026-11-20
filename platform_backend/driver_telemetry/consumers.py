import asyncio
import hashlib
import json
import logging
import time
from decimal import Decimal, InvalidOperation

from channels.db import database_sync_to_async
from channels.exceptions import ChannelFull
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from redis.asyncio import Redis
from redis.exceptions import RedisError
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError

from ambulances.models import AmbulanceRequest
from hospitals.models import HospitalStaff
from .models import DriverTelemetrySession

logger = logging.getLogger(__name__)
User = get_user_model()
LOCATION_TTL_SECONDS = 300
MIN_LOCATION_INTERVAL_SECONDS = 1.0


def _token_hash(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def _location_key(request_id):
    return f'mediconnect:ambulance:location:{request_id}'


class _TelemetryConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.authenticated = False
        self.group_name = None
        self.redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
        self.auth_timeout_task = asyncio.create_task(self._close_if_unauthenticated())
        await self.accept()

    async def disconnect(self, close_code):
        if self.auth_timeout_task:
            self.auth_timeout_task.cancel()
        if self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        await self.redis.aclose()

    async def _close_if_unauthenticated(self):
        await asyncio.sleep(8)
        if not self.authenticated:
            await self.close(code=4401)

    async def location_update(self, event):
        await self.send_json({'type': 'location', **event['payload']})


class DriverLocationConsumer(_TelemetryConsumer):
    async def receive_json(self, content, **kwargs):
        if not self.authenticated:
            if content.get('type') != 'authenticate' or not isinstance(content.get('token'), str):
                await self.close(code=4401)
                return
            session = await self._get_session(content['token'])
            if not session:
                await self.close(code=4401)
                return
            self.session_id = session['id']
            self.request_id = session['request_id']
            self.authenticated = True
            self.auth_timeout_task.cancel()
            await self.send_json({
                'type': 'authenticated',
                'ambulance_request_id': self.request_id,
                'expires_at': session['expires_at'],
            })
            return

        if content.get('type') == 'stop':
            await database_sync_to_async(
                DriverTelemetrySession.objects.filter(
                    pk=self.session_id,
                    revoked_at__isnull=True,
                ).update
            )(revoked_at=timezone.now())
            await self.send_json({'type': 'stopped'})
            await self.close(code=1000)
            return

        if content.get('type') != 'location':
            await self.send_json({'type': 'error', 'detail': 'Unsupported telemetry message.'})
            return
        now = time.monotonic()
        if now - getattr(self, 'last_location_at', 0) < MIN_LOCATION_INTERVAL_SECONDS:
            return
        location = self._validate_location(content)
        if location is None:
            await self.send_json({'type': 'error', 'detail': 'Invalid location coordinates or ETA.'})
            return
        if not await self._request_is_en_route():
            await self.close(code=4403)
            return

        self.last_location_at = now
        payload = {
            **location,
            'received_at': timezone.now().isoformat(),
        }
        try:
            await self.redis.set(
                _location_key(self.request_id),
                json.dumps(payload),
                ex=LOCATION_TTL_SECONDS,
            )
            await self.channel_layer.group_send(
                f'ambulance_{self.request_id}',
                {'type': 'location.update', 'payload': payload},
            )
        except (RedisError, OSError, ChannelFull):
            logger.exception('Could not publish ambulance telemetry for request %s', self.request_id)
            await self.send_json({'type': 'error', 'detail': 'Location could not be delivered. Retry shortly.'})

    @staticmethod
    def _validate_location(content):
        try:
            latitude = Decimal(str(content['latitude']))
            longitude = Decimal(str(content['longitude']))
        except (KeyError, InvalidOperation, ValueError):
            return None
        if not latitude.is_finite() or not longitude.is_finite():
            return None
        if not Decimal('-90') <= latitude <= Decimal('90'):
            return None
        if not Decimal('-180') <= longitude <= Decimal('180'):
            return None
        result = {'latitude': float(latitude), 'longitude': float(longitude)}
        eta = content.get('eta_minutes')
        if eta is not None:
            if isinstance(eta, bool) or not isinstance(eta, int) or not 0 <= eta <= 1440:
                return None
            result['eta_minutes'] = eta
        return result

    @database_sync_to_async
    def _get_session(self, token):
        now = timezone.now()
        try:
            session = DriverTelemetrySession.objects.select_related(
                'ambulance_request',
            ).get(
                access_token_hash=_token_hash(token),
                link_used_at__isnull=False,
                revoked_at__isnull=True,
                expires_at__gt=now,
                ambulance_request__status=AmbulanceRequest.Status.EN_ROUTE,
            )
        except DriverTelemetrySession.DoesNotExist:
            return None
        return {
            'id': session.pk,
            'request_id': session.ambulance_request_id,
            'expires_at': session.expires_at.isoformat(),
        }

    @database_sync_to_async
    def _request_is_en_route(self):
        return AmbulanceRequest.objects.filter(
            pk=self.request_id,
            status=AmbulanceRequest.Status.EN_ROUTE,
        ).exists()


class LocationViewerConsumer(_TelemetryConsumer):
    async def connect(self):
        self.request_id = self.scope['url_route']['kwargs']['request_id']
        await super().connect()

    async def receive_json(self, content, **kwargs):
        if self.authenticated:
            await self.close(code=4400)
            return
        if content.get('type') != 'authenticate' or not isinstance(content.get('token'), str):
            await self.close(code=4401)
            return
        user = await self._get_user(content['token'])
        if user is None or not await self._may_view(user.pk):
            await self.close(code=4403)
            return

        self.authenticated = True
        self.auth_timeout_task.cancel()
        self.group_name = f'ambulance_{self.request_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.send_json({'type': 'authenticated'})
        try:
            latest = await self.redis.get(_location_key(self.request_id))
        except (RedisError, OSError):
            logger.exception('Could not read live ambulance telemetry for request %s', self.request_id)
            await self.close(code=1011)
            return
        if latest:
            await self.send_json({'type': 'location', **json.loads(latest)})

    @database_sync_to_async
    def _get_user(self, token):
        try:
            validated = JWTAuthentication().get_validated_token(token)
            return JWTAuthentication().get_user(validated)
        except (AuthenticationFailed, TokenError, User.DoesNotExist, KeyError, TypeError, ValueError):
            return None

    @database_sync_to_async
    def _may_view(self, user_id):
        try:
            request = AmbulanceRequest.objects.select_related(
                'destination_hospital',
                'patient',
                'interfacility_referral__source_hospital',
                'interfacility_referral__receiving_hospital',
            ).get(pk=self.request_id)
        except AmbulanceRequest.DoesNotExist:
            return False
        user = User.objects.filter(pk=user_id, is_active=True).first()
        if not user:
            return False
        if user.is_superuser or user.role == 'ADMIN' or request.patient_id == user_id:
            return True

        hospital_ids = [request.destination_hospital_id]
        referral = getattr(request, 'interfacility_referral', None)
        if referral:
            hospital_ids.append(referral.source_hospital_id)
            hospital_ids.append(referral.receiving_hospital_id)

        return HospitalStaff.objects.filter(
            user_id=user_id,
            hospital_id__in=hospital_ids,
            is_active=True,
        ).exists()
