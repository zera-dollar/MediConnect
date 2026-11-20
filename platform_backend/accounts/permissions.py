from rest_framework import permissions


class IsHealthcareProfessional(permissions.BasePermission):
    """Only doctors, nurses, specialists."""
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_healthcare_professional
        )


class IsVerifiedHealthcareProfessional(IsHealthcareProfessional):
    """Only verified healthcare professionals can perform restricted actions."""

    message = 'Professional credentials must be verified before bidding.'

    def has_permission(self, request, view):
        return (
            super().has_permission(request, view)
            and request.user.is_verified
        )


class IsHospitalAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and (request.user.is_hospital_admin or request.user.is_superuser)
        )


class IsOwnerOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser or request.user.role == 'ADMIN':
            return True
        return obj == request.user or getattr(obj, 'user', None) == request.user
