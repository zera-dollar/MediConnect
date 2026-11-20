from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from hospitals.models import HospitalStaff
from notifications.models import Notification
from resources.models import HospitalResource, ResourceTransaction
from .models import AmbulanceRequest, InterfacilityReferral
from .serializers import (
    AmbulanceDispatchSerializer,
    AmbulanceLocationSerializer,
    AmbulanceRequestSerializer,
    AmbulanceStatusSerializer,
    InterfacilityReferralSerializer,
)


@extend_schema_view(
    list=extend_schema(tags=['Ambulance']),
    retrieve=extend_schema(tags=['Ambulance']),
    create=extend_schema(tags=['Ambulance']),
)
class AmbulanceRequestViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = AmbulanceRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = AmbulanceRequest.objects.select_related(
        'patient',
        'destination_hospital',
        'dispatcher',
        'interfacility_referral__source_hospital',
    )

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        if not user.is_authenticated:
            return queryset.none()
        if user.is_superuser or user.role == 'ADMIN':
            return queryset

        managed_hospitals = HospitalStaff.objects.filter(
            user=user,
            is_active=True,
            role_at_hospital__in=['ADMIN', 'MANAGER', 'COORDINATOR'],
        ).values_list('hospital_id', flat=True)
        return queryset.filter(
            Q(patient=user) | Q(destination_hospital_id__in=managed_hospitals)
            | Q(interfacility_referral__source_hospital_id__in=managed_hospitals)
        ).distinct()

    def _can_dispatch(self, user, ambulance_request):
        if user.is_superuser or user.role == 'ADMIN':
            return True
        return HospitalStaff.objects.filter(
            user=user,
            hospital=ambulance_request.destination_hospital,
            is_active=True,
            role_at_hospital__in=['ADMIN', 'MANAGER', 'COORDINATOR'],
        ).exists()

    def _require_dispatcher(self, request, ambulance_request):
        if not self._can_dispatch(request.user, ambulance_request):
            raise PermissionDenied('Only the destination hospital dispatch team can manage this request.')

    def _notify_patient(self, ambulance_request, message):
        Notification.objects.create(
            recipient=ambulance_request.patient,
            notification_type=Notification.NotificationType.AMBULANCE_UPDATE,
            title='Ambulance request update',
            message=message,
            data={
                'ambulance_request_id': ambulance_request.pk,
                'status': ambulance_request.status,
            },
        )

    def _release_referral_reservation(self, ambulance_request, user):
        try:
            referral = InterfacilityReferral.objects.select_for_update().get(
                ambulance_request=ambulance_request,
                status=InterfacilityReferral.Status.ACCEPTED,
            )
        except InterfacilityReferral.DoesNotExist:
            return
        if not referral.reservation_transaction_id:
            return

        reservation = referral.reservation_transaction
        quantity = abs(reservation.quantity)
        resource = HospitalResource.objects.select_for_update().get(
            pk=reservation.hospital_resource_id,
        )
        if resource.reserved_quantity < quantity:
            raise ValidationError({
                'resource': 'The referral reservation cannot be safely released; contact a hospital administrator.'
            })
        previous_available = resource.available_quantity
        resource.available_quantity += quantity
        resource.reserved_quantity -= quantity
        resource.updated_by = user
        resource.save(update_fields=(
            'available_quantity',
            'reserved_quantity',
            'updated_by',
            'last_updated',
        ))
        ResourceTransaction.objects.create(
            hospital_resource=resource,
            transaction_type=ResourceTransaction.TransactionType.RELEASE,
            quantity=quantity,
            previous_available=previous_available,
            new_available=resource.available_quantity,
            performed_by=user,
            reason=f'Cancelled interfacility referral {referral.pk}',
            reference=f'referral:{referral.pk}:cancel',
            metadata={'referral_id': referral.pk},
        )
        referral.status = InterfacilityReferral.Status.CANCELLED
        referral.save(update_fields=['status', 'updated_at'])

    def perform_create(self, serializer):
        ambulance_request = serializer.save(patient=self.request.user)
        managers = HospitalStaff.objects.filter(
            hospital=ambulance_request.destination_hospital,
            is_active=True,
            role_at_hospital__in=['ADMIN', 'MANAGER', 'COORDINATOR'],
        ).exclude(user=self.request.user).select_related('user')
        for membership in managers:
            Notification.objects.create(
                recipient=membership.user,
                notification_type=Notification.NotificationType.AMBULANCE_REQUEST,
                title='New ambulance request',
                message=(
                    f'{ambulance_request.patient.get_full_name() or ambulance_request.patient.email} '
                    f'requested transport to {ambulance_request.destination_hospital.name}.'
                ),
                data={'ambulance_request_id': ambulance_request.pk},
            )

    @extend_schema(
        request=AmbulanceDispatchSerializer,
        responses=AmbulanceRequestSerializer,
        tags=['Ambulance'],
    )
    @action(detail=True, methods=['post'], url_path='dispatch')
    def dispatch_ambulance(self, request, pk=None):
        ambulance_request = self.get_object()
        self._require_dispatcher(request, ambulance_request)
        if ambulance_request.status != AmbulanceRequest.Status.REQUESTED:
            raise ValidationError({'status': 'Only a newly requested ambulance can be dispatched.'})

        serializer = AmbulanceDispatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        now = timezone.now()
        ambulance_request.ambulance_code = data['ambulance_code']
        ambulance_request.ambulance_latitude = data['latitude']
        ambulance_request.ambulance_longitude = data['longitude']
        ambulance_request.eta_minutes = data['eta_minutes']
        ambulance_request.dispatcher = request.user
        ambulance_request.status = AmbulanceRequest.Status.EN_ROUTE
        ambulance_request.dispatched_at = now
        ambulance_request.save()
        self._notify_patient(
            ambulance_request,
            f'Ambulance {ambulance_request.ambulance_code} is en route. '
            f'Estimated arrival: {ambulance_request.eta_minutes} minutes.',
        )
        return Response(self.get_serializer(ambulance_request).data)

    @extend_schema(
        request=AmbulanceLocationSerializer,
        responses=AmbulanceRequestSerializer,
        tags=['Ambulance'],
    )
    @action(detail=True, methods=['post'], url_path='location')
    def update_location(self, request, pk=None):
        ambulance_request = self.get_object()
        self._require_dispatcher(request, ambulance_request)
        if ambulance_request.status != AmbulanceRequest.Status.EN_ROUTE:
            raise ValidationError({'status': 'Location can only be updated while the ambulance is en route.'})

        serializer = AmbulanceLocationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        ambulance_request.ambulance_latitude = data['latitude']
        ambulance_request.ambulance_longitude = data['longitude']
        if 'eta_minutes' in data:
            ambulance_request.eta_minutes = data['eta_minutes']
        ambulance_request.save()
        return Response(self.get_serializer(ambulance_request).data)

    @extend_schema(
        request=AmbulanceStatusSerializer,
        responses=AmbulanceRequestSerializer,
        tags=['Ambulance'],
    )
    @action(detail=True, methods=['post'], url_path='status')
    def update_status(self, request, pk=None):
        ambulance_request = self.get_object()
        self._require_dispatcher(request, ambulance_request)
        serializer = AmbulanceStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data['status']
        transitions = {
            AmbulanceRequest.Status.EN_ROUTE: {
                AmbulanceRequest.Status.ARRIVED,
                AmbulanceRequest.Status.CANCELLED,
            },
            AmbulanceRequest.Status.ARRIVED: {
                AmbulanceRequest.Status.COMPLETED,
            },
        }
        if new_status not in transitions.get(ambulance_request.status, set()):
            raise ValidationError({
                'status': f'Cannot change status from {ambulance_request.status} to {new_status}.'
            })

        now = timezone.now()
        with transaction.atomic():
            if new_status == AmbulanceRequest.Status.CANCELLED:
                self._release_referral_reservation(ambulance_request, request.user)
            ambulance_request.status = new_status
            if new_status == AmbulanceRequest.Status.ARRIVED:
                ambulance_request.arrived_at = now
                ambulance_request.eta_minutes = 0
            elif new_status == AmbulanceRequest.Status.COMPLETED:
                ambulance_request.completed_at = now
            elif new_status == AmbulanceRequest.Status.CANCELLED:
                ambulance_request.cancelled_at = now
            ambulance_request.save()
        self._notify_patient(
            ambulance_request,
            f'Your ambulance request is now {ambulance_request.get_status_display().lower()}.',
        )
        return Response(self.get_serializer(ambulance_request).data)

    @extend_schema(
        request=None,
        responses=AmbulanceRequestSerializer,
        tags=['Ambulance'],
    )
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        ambulance_request = self.get_object()
        if ambulance_request.patient_id != request.user.id:
            raise PermissionDenied('Only the patient who created this request can cancel it.')
        if ambulance_request.status != AmbulanceRequest.Status.REQUESTED:
            raise ValidationError({'status': 'Only a request that has not been dispatched can be cancelled.'})
        with transaction.atomic():
            self._release_referral_reservation(ambulance_request, request.user)
            ambulance_request.status = AmbulanceRequest.Status.CANCELLED
            ambulance_request.cancelled_at = timezone.now()
            ambulance_request.save()
        return Response(self.get_serializer(ambulance_request).data)


class InterfacilityReferralViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = InterfacilityReferralSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = InterfacilityReferral.objects.select_related(
        'source_hospital',
        'receiving_hospital',
        'patient',
        'resource_type',
        'ambulance_request',
    )

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        if not user.is_authenticated:
            return queryset.none()
        if user.is_superuser or user.role == 'ADMIN':
            return queryset
        hospital_ids = HospitalStaff.objects.filter(
            user=user,
            is_active=True,
        ).values_list('hospital_id', flat=True)
        return queryset.filter(
            Q(source_hospital_id__in=hospital_ids)
            | Q(receiving_hospital_id__in=hospital_ids)
        ).distinct()

    def perform_create(self, serializer):
        referral = serializer.save(referred_by=self.request.user)
        recipients = HospitalStaff.objects.filter(
            hospital=referral.receiving_hospital,
            is_active=True,
            role_at_hospital__in=['ADMIN', 'MANAGER', 'COORDINATOR'],
        ).select_related('user')
        for membership in recipients:
            Notification.objects.create(
                recipient=membership.user,
                notification_type=Notification.NotificationType.SYSTEM,
                title='New interfacility referral',
                message=f'A referral requires review at {referral.receiving_hospital.name}.',
                data={'referral_id': referral.pk},
            )

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        referral = self.get_object()
        if not HospitalStaff.objects.filter(
            user=request.user,
            hospital=referral.receiving_hospital,
            is_active=True,
            role_at_hospital__in=['ADMIN', 'MANAGER', 'COORDINATOR'],
        ).exists():
            raise PermissionDenied('Only receiving hospital managers or coordinators can accept this referral.')

        with transaction.atomic():
            referral = InterfacilityReferral.objects.select_for_update().select_related(
                'source_hospital',
                'receiving_hospital',
            ).get(pk=referral.pk)
            if referral.status != InterfacilityReferral.Status.PENDING:
                raise ValidationError({'status': 'Only a pending referral can be accepted.'})

            source_hospital = referral.source_hospital
            if source_hospital.latitude is None or source_hospital.longitude is None:
                raise ValidationError({
                    'source_hospital': 'The source hospital must have coordinates before an ambulance can be requested.'
                })

            resource = HospitalResource.objects.select_for_update().filter(
                hospital=referral.receiving_hospital,
                resource_type=referral.resource_type,
                resource_type__is_active=True,
                is_active=True,
                available_quantity__gte=referral.resource_quantity,
            ).order_by('pk').first()
            if resource is None:
                raise ValidationError({
                    'resource_quantity': 'The receiving hospital does not have enough available resource.'
                })

            previous_available = resource.available_quantity
            reserved = HospitalResource.objects.filter(
                pk=resource.pk,
                available_quantity=previous_available,
            ).update(
                available_quantity=F('available_quantity') - referral.resource_quantity,
                reserved_quantity=F('reserved_quantity') + referral.resource_quantity,
                updated_by=request.user,
                last_updated=timezone.now(),
            )
            if reserved != 1:
                raise ValidationError({
                    'resource_quantity': 'Resource availability changed. Retry acceptance.'
                })
            resource.refresh_from_db()
            reservation = ResourceTransaction.objects.create(
                hospital_resource=resource,
                transaction_type=ResourceTransaction.TransactionType.RESERVE,
                quantity=-referral.resource_quantity,
                previous_available=previous_available,
                new_available=resource.available_quantity,
                performed_by=request.user,
                reason=f'Accepted interfacility referral {referral.pk}',
                reference=f'referral:{referral.pk}',
                metadata={'referral_id': referral.pk},
            )
            ambulance_request = AmbulanceRequest.objects.create(
                patient=referral.patient,
                destination_hospital=referral.receiving_hospital,
                pickup_address=source_hospital.address,
                pickup_latitude=source_hospital.latitude,
                pickup_longitude=source_hospital.longitude,
            )
            referral.status = InterfacilityReferral.Status.ACCEPTED
            referral.accepted_by = request.user
            referral.accepted_at = timezone.now()
            referral.reservation_transaction = reservation
            referral.ambulance_request = ambulance_request
            referral.save(update_fields=(
                'status',
                'accepted_by',
                'accepted_at',
                'reservation_transaction',
                'ambulance_request',
                'updated_at',
            ))
            for recipient in {referral.patient_id, referral.referred_by_id}:
                Notification.objects.create(
                    recipient_id=recipient,
                    notification_type=Notification.NotificationType.SYSTEM,
                    title='Interfacility referral accepted',
                    message=(
                        f'{referral.receiving_hospital.name} accepted the referral. '
                        'Transport is waiting for dispatch.'
                    ),
                    data={
                        'referral_id': referral.pk,
                        'ambulance_request_id': ambulance_request.pk,
                    },
                )

        return Response(self.get_serializer(referral).data, status=status.HTTP_200_OK)
