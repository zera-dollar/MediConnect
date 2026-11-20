from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, extend_schema_view
from django.contrib.auth import get_user_model

from .models import Hospital, Department, HospitalStaff
from .serializers import (
    HospitalSerializer,
    HospitalListSerializer,
    DepartmentSerializer,
    HospitalStaffSerializer,
)
from accounts.permissions import IsHospitalAdmin

User = get_user_model()


@extend_schema_view(
    list=extend_schema(tags=['Hospitals']),
    retrieve=extend_schema(tags=['Hospitals']),
    create=extend_schema(tags=['Hospitals']),
    update=extend_schema(tags=['Hospitals']),
    partial_update=extend_schema(tags=['Hospitals']),
    destroy=extend_schema(tags=['Hospitals']),
)
class HospitalViewSet(viewsets.ModelViewSet):
    queryset = Hospital.objects.filter(is_active=True)
    search_fields = ['name', 'city', 'registration_number']
    filterset_fields = ['city', 'country', 'is_active']

    def get_serializer_class(self):
        if self.action == 'list':
            return HospitalListSerializer
        return HospitalSerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [permissions.IsAuthenticated(), IsHospitalAdmin()]
        return [permissions.IsAuthenticated()]

    @action(detail=True, methods=['get'])
    def departments(self, request, pk=None):
        hospital = self.get_object()
        depts = hospital.departments.filter(is_active=True)
        serializer = DepartmentSerializer(depts, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='mine')
    def mine(self, request):
        if request.user.is_superuser or request.user.role == 'ADMIN':
            rows = [
                {**data, 'role_at_hospital': 'ADMIN'}
                for data in HospitalListSerializer(self.get_queryset(), many=True).data
            ]
            return Response(rows)
        memberships = HospitalStaff.objects.filter(
            user=request.user,
            is_active=True,
            hospital__is_active=True,
        ).select_related('hospital')
        rows = []
        for membership in memberships:
            row = HospitalListSerializer(membership.hospital).data
            row['role_at_hospital'] = membership.role_at_hospital
            rows.append(row)
        return Response(rows)

    @action(detail=True, methods=['get'])
    def staff(self, request, pk=None):
        hospital = self.get_object()
        staff = hospital.staff_members.filter(is_active=True)
        serializer = HospitalStaffSerializer(staff, many=True)
        return Response(serializer.data)


@extend_schema_view(
    list=extend_schema(tags=['Departments']),
    retrieve=extend_schema(tags=['Departments']),
    create=extend_schema(tags=['Departments']),
    update=extend_schema(tags=['Departments']),
    partial_update=extend_schema(tags=['Departments']),
    destroy=extend_schema(tags=['Departments']),
)
class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.filter(is_active=True)
    serializer_class = DepartmentSerializer
    filterset_fields = ['hospital', 'is_active']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [permissions.IsAuthenticated(), IsHospitalAdmin()]
        return [permissions.IsAuthenticated()]


@extend_schema_view(
    list=extend_schema(tags=['Hospital Staff']),
    retrieve=extend_schema(tags=['Hospital Staff']),
    create=extend_schema(tags=['Hospital Staff']),
    update=extend_schema(tags=['Hospital Staff']),
    partial_update=extend_schema(tags=['Hospital Staff']),
    destroy=extend_schema(tags=['Hospital Staff']),
)
class HospitalStaffViewSet(viewsets.ModelViewSet):
    queryset = HospitalStaff.objects.filter(is_active=True)
    serializer_class = HospitalStaffSerializer
    filterset_fields = ['hospital', 'role_at_hospital', 'is_active']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [permissions.IsAuthenticated(), IsHospitalAdmin()]
        return [permissions.IsAuthenticated()]
