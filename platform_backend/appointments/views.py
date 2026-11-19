from django.contrib.auth import get_user_model
from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied

from .models import Appointment
from .serializers import (
    AppointmentSerializer,
    HEALTHCARE_ROLES,
    HealthcareProfessionalSerializer,
)


User = get_user_model()


class HealthcareProfessionalListView(generics.ListAPIView):
    serializer_class = HealthcareProfessionalSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = User.objects.filter(
        is_active=True,
        role__in=HEALTHCARE_ROLES,
        availability_status='AVAILABLE',
    ).order_by('last_name', 'first_name', 'email')


class AppointmentListCreateView(generics.ListCreateAPIView):
    serializer_class = AppointmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Appointment.objects.select_related('patient', 'professional')

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or user.role == User.Role.ADMIN:
            return self.queryset
        if user.role == User.Role.PATIENT:
            return self.queryset.filter(patient=user)
        if user.role in HEALTHCARE_ROLES:
            return self.queryset.filter(professional=user)
        return self.queryset.none()

    def perform_create(self, serializer):
        if self.request.user.role != User.Role.PATIENT:
            raise PermissionDenied('Only patient accounts can create appointments.')
        serializer.save(patient=self.request.user)
