from rest_framework import viewsets, permissions, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter

from .models import WorkContract, Bid, ContractAssignment
from .serializers import (
    WorkContractSerializer,
    WorkContractListSerializer,
    BidSerializer,
    BidCreateSerializer,
    BidReviewSerializer,
    ContractAssignmentSerializer,
)
from accounts.permissions import (
    IsHospitalAdmin,
    IsVerifiedHealthcareProfessional,
)
from notifications.models import Notification

User = get_user_model()


@extend_schema_view(
    list=extend_schema(tags=['Contracts']),
    retrieve=extend_schema(tags=['Contracts']),
    create=extend_schema(tags=['Contracts']),
    update=extend_schema(tags=['Contracts']),
    partial_update=extend_schema(tags=['Contracts']),
    destroy=extend_schema(tags=['Contracts']),
)
class WorkContractViewSet(viewsets.ModelViewSet):
    queryset = WorkContract.objects.select_related(
        'hospital', 'department', 'created_by'
    ).prefetch_related('bids')
    search_fields = ['title', 'description', 'specialization_required', 'hospital__name']
    filterset_fields = [
        'status', 'contract_type', 'required_role', 'urgency',
        'hospital', 'department',
    ]
    ordering_fields = ['start_datetime', 'created_at', 'urgency', 'budget_max']

    def get_serializer_class(self):
        if self.action == 'list':
            return WorkContractListSerializer
        return WorkContractSerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'publish', 'close'):
            return [permissions.IsAuthenticated(), IsHospitalAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Professionals see only OPEN public contracts (or their own filled ones)
        if user.is_healthcare_professional:
            return qs.filter(
                status__in=[
                    WorkContract.Status.OPEN,
                    WorkContract.Status.FILLED,
                    WorkContract.Status.COMPLETED,
                ],
                is_public=True
            )
        # Hospital admins see contracts of their hospitals
        if user.is_hospital_admin:
            hospital_ids = user.hospital_memberships.filter(
                is_active=True
            ).values_list('hospital_id', flat=True)
            return qs.filter(hospital_id__in=hospital_ids)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, status=WorkContract.Status.DRAFT)

    @extend_schema(tags=['Contracts'], request=None)
    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        contract = self.get_object()
        if contract.status != WorkContract.Status.DRAFT:
            return Response(
                {"detail": "Only draft contracts can be published."},
                status=status.HTTP_400_BAD_REQUEST
            )
        contract.status = WorkContract.Status.OPEN
        contract.published_at = timezone.now()
        contract.save(update_fields=['status', 'published_at', 'updated_at'])
        return Response(WorkContractSerializer(contract).data)

    @extend_schema(tags=['Contracts'], request=None)
    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        contract = self.get_object()
        if contract.status != WorkContract.Status.OPEN:
            return Response(
                {"detail": "Only open contracts can be closed."},
                status=status.HTTP_400_BAD_REQUEST
            )
        contract.status = WorkContract.Status.CLOSED
        contract.save(update_fields=['status', 'updated_at'])
        return Response(WorkContractSerializer(contract).data)


@extend_schema_view(
    list=extend_schema(tags=['Bids']),
    retrieve=extend_schema(tags=['Bids']),
    create=extend_schema(tags=['Bids']),
    update=extend_schema(tags=['Bids']),
    partial_update=extend_schema(tags=['Bids']),
    destroy=extend_schema(tags=['Bids']),
)
class BidViewSet(viewsets.ModelViewSet):
    queryset = Bid.objects.select_related(
        'contract', 'contract__hospital', 'bidder', 'reviewed_by'
    )
    search_fields = ['message', 'contract__title', 'bidder__email']
    filterset_fields = ['status', 'contract', 'bidder']

    def get_serializer_class(self):
        if self.action == 'create':
            return BidCreateSerializer
        return BidSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.IsAuthenticated(), IsVerifiedHealthcareProfessional()]
        if self.action in ('review',):
            return [permissions.IsAuthenticated(), IsHospitalAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_healthcare_professional:
            return qs.filter(bidder=user)
        if user.is_hospital_admin:
            hospital_ids = user.hospital_memberships.filter(
                is_active=True
            ).values_list('hospital_id', flat=True)
            return qs.filter(contract__hospital_id__in=hospital_ids)
        return qs

    def perform_create(self, serializer):
        bid = serializer.save(bidder=self.request.user)
        # Notify hospital admins
        hospital = bid.contract.hospital
        for membership in hospital.staff_members.filter(
            role_at_hospital__in=['ADMIN', 'MANAGER', 'COORDINATOR'],
            is_active=True
        ):
            Notification.objects.create(
                recipient=membership.user,
                notification_type=Notification.NotificationType.BID_RECEIVED,
                title=f"New bid on {bid.contract.title}",
                message=f"{bid.bidder.get_full_name()} submitted a bid of {bid.proposed_rate} {bid.currency}.",
                data={'bid_id': bid.id, 'contract_id': bid.contract_id}
            )

    @extend_schema(tags=['Bids'], request=BidReviewSerializer)
    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        bid = self.get_object()
        if bid.status != Bid.Status.PENDING:
            return Response(
                {"detail": "Only pending bids can be reviewed."},
                status=status.HTTP_400_BAD_REQUEST
            )
        serializer = BidReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data['status']
        notes = serializer.validated_data.get('review_notes', '')

        if new_status == Bid.Status.ACCEPTED and not bid.bidder.is_verified:
            return Response(
                {"detail": "A bid cannot be accepted unless the bidder's credentials are verified."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            if new_status == Bid.Status.ACCEPTED:
                bidder_is_verified = User.objects.select_for_update().filter(
                    pk=bid.bidder_id,
                    is_verified=True,
                ).exists()
                if not bidder_is_verified:
                    return Response(
                        {"detail": "A bid cannot be accepted unless the bidder's credentials are verified."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            bid.status = new_status
            bid.reviewed_by = request.user
            bid.reviewed_at = timezone.now()
            bid.review_notes = notes
            bid.save()

            if new_status == Bid.Status.ACCEPTED:
                # Close other pending bids
                Bid.objects.filter(
                    contract=bid.contract,
                    status=Bid.Status.PENDING
                ).exclude(pk=bid.pk).update(
                    status=Bid.Status.REJECTED,
                    reviewed_by=request.user,
                    reviewed_at=timezone.now(),
                    review_notes='Automatically rejected because another bid was accepted.'
                )
                # Update contract
                contract = bid.contract
                contract.status = WorkContract.Status.FILLED
                contract.filled_by = bid.bidder
                contract.save(update_fields=['status', 'filled_by', 'updated_at'])
                # Create assignment
                ContractAssignment.objects.create(
                    contract=contract,
                    professional=bid.bidder,
                    accepted_bid=bid,
                    agreed_rate=bid.proposed_rate,
                    currency=bid.currency,
                    start_datetime=contract.start_datetime,
                    end_datetime=contract.end_datetime,
                )
                # Notify winner
                Notification.objects.create(
                    recipient=bid.bidder,
                    notification_type=Notification.NotificationType.BID_ACCEPTED,
                    title=f"Bid accepted: {contract.title}",
                    message=f"Your bid of {bid.proposed_rate} {bid.currency} has been accepted.",
                    data={'bid_id': bid.id, 'contract_id': contract.id}
                )
            else:
                Notification.objects.create(
                    recipient=bid.bidder,
                    notification_type=Notification.NotificationType.BID_REJECTED,
                    title=f"Bid not selected: {bid.contract.title}",
                    message=notes or "Your bid was not selected for this contract.",
                    data={'bid_id': bid.id, 'contract_id': bid.contract_id}
                )

        return Response(BidSerializer(bid).data)


@extend_schema_view(
    list=extend_schema(tags=['Assignments']),
    retrieve=extend_schema(tags=['Assignments']),
    update=extend_schema(tags=['Assignments']),
    partial_update=extend_schema(tags=['Assignments']),
)
class ContractAssignmentViewSet(viewsets.ModelViewSet):
    queryset = ContractAssignment.objects.select_related(
        'contract', 'contract__hospital', 'professional', 'accepted_bid'
    )
    serializer_class = ContractAssignmentSerializer
    filterset_fields = ['status', 'professional', 'contract']
    http_method_names = ['get', 'post', 'put', 'patch', 'head', 'options']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_healthcare_professional:
            return qs.filter(professional=user)
        if user.is_hospital_admin:
            hospital_ids = user.hospital_memberships.filter(
                is_active=True
            ).values_list('hospital_id', flat=True)
            return qs.filter(contract__hospital_id__in=hospital_ids)
        return qs

    @extend_schema(tags=['Assignments'], request=None)
    @action(detail=True, methods=['post'])
    def check_in(self, request, pk=None):
        assignment = self.get_object()
        if assignment.status != 'SCHEDULED':
            return Response(
                {"detail": "Can only check in to scheduled assignments."},
                status=status.HTTP_400_BAD_REQUEST
            )
        assignment.check_in_time = timezone.now()
        assignment.status = 'IN_PROGRESS'
        assignment.save(update_fields=['check_in_time', 'status', 'updated_at'])
        return Response(ContractAssignmentSerializer(assignment).data)

    @extend_schema(tags=['Assignments'], request=None)
    @action(detail=True, methods=['post'])
    def check_out(self, request, pk=None):
        assignment = self.get_object()
        if assignment.status != 'IN_PROGRESS':
            return Response(
                {"detail": "Can only check out of in-progress assignments."},
                status=status.HTTP_400_BAD_REQUEST
            )
        assignment.check_out_time = timezone.now()
        assignment.status = 'COMPLETED'
        assignment.save(update_fields=['check_out_time', 'status', 'updated_at'])
        # Also mark contract completed
        contract = assignment.contract
        contract.status = WorkContract.Status.COMPLETED
        contract.save(update_fields=['status', 'updated_at'])
        return Response(ContractAssignmentSerializer(assignment).data)
