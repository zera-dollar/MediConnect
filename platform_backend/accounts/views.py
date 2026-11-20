from rest_framework import generics, status, permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.db import transaction
from drf_spectacular.utils import extend_schema, extend_schema_view

from .serializers import (
    UserRegistrationSerializer,
    UserSerializer,
    UserProfileUpdateSerializer,
    ProfessionalDocumentSerializer,
    ChangePasswordSerializer,
)
from .models import ProfessionalDocument
from .tasks import verify_professional_document
from .permissions import IsOwnerOrAdmin

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['email'] = user.email
        token['full_name'] = user.get_full_name()
        token['is_verified'] = user.is_verified
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


@extend_schema(tags=['Authentication'])
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]


@extend_schema(tags=['Users'])
class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return UserProfileUpdateSerializer
        return UserSerializer


@extend_schema(tags=['Users'])
class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return Response(
                {"old_password": "Wrong password."},
                status=status.HTTP_400_BAD_REQUEST
            )
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({"detail": "Password updated successfully."})


@extend_schema_view(
    list=extend_schema(tags=['Users']),
    retrieve=extend_schema(tags=['Users']),
)
class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """List / retrieve users (mainly for hospital admins searching professionals)."""
    queryset = User.objects.filter(is_active=True)
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ['email', 'first_name', 'last_name', 'specialization', 'license_number']
    filterset_fields = ['role', 'specialization', 'is_verified', 'availability_status']

    def get_queryset(self):
        qs = super().get_queryset()
        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(role=role)
        return qs


@extend_schema(tags=['Documents'])
class ProfessionalDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = ProfessionalDocumentSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]

    def get_queryset(self):
        if self.request.user.is_superuser or self.request.user.role == 'ADMIN':
            return ProfessionalDocument.objects.all()
        return ProfessionalDocument.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        document = serializer.save(
            user=self.request.user,
            verification_status=User.VerificationStatus.PENDING,
        )
        user = self.request.user
        user.is_verified = False
        user.verification_status = User.VerificationStatus.PENDING
        user.save(update_fields=['is_verified', 'verification_status', 'updated_at'])
        transaction.on_commit(
            lambda: verify_professional_document.delay(document.pk)
        )
