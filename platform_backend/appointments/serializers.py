from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from .models import Appointment


User = get_user_model()
HEALTHCARE_ROLES = (User.Role.DOCTOR, User.Role.NURSE, User.Role.SPECIALIST)


class HealthcareProfessionalSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'full_name', 'role', 'specialization', 'availability_status')

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.email


class AppointmentSerializer(serializers.ModelSerializer):
    professional = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(
            is_active=True,
            role__in=HEALTHCARE_ROLES,
            availability_status='AVAILABLE',
        ),
    )
    professional_name = serializers.SerializerMethodField()
    professional_role = serializers.CharField(source='professional.role', read_only=True)
    professional_specialization = serializers.CharField(
        source='professional.specialization',
        read_only=True,
    )
    patient = serializers.PrimaryKeyRelatedField(read_only=True)
    status = serializers.ChoiceField(
        choices=Appointment.Status.choices,
        read_only=True,
    )

    class Meta:
        model = Appointment
        fields = (
            'id',
            'patient',
            'professional',
            'professional_name',
            'professional_role',
            'professional_specialization',
            'patient_name',
            'patient_email',
            'patient_phone',
            'start_datetime',
            'duration_minutes',
            'status',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def get_professional_name(self, obj):
        return obj.professional.get_full_name() or obj.professional.email

    def validate(self, attrs):
        if not attrs.get('patient_email') and not attrs.get('patient_phone'):
            raise serializers.ValidationError({
                'patient_email': 'Provide an email address or phone number.',
            })
        if attrs['start_datetime'] <= timezone.now():
            raise serializers.ValidationError({
                'start_datetime': 'Choose a future date and time.',
            })
        return attrs
