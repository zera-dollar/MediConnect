from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import serializers

from hospitals.models import Hospital, HospitalStaff
from resources.models import ResourceType
from .models import AmbulanceRequest, InterfacilityReferral

User = get_user_model()


class AmbulanceRequestSerializer(serializers.ModelSerializer):
    destination_hospital_name = serializers.CharField(
        source='destination_hospital.name',
        read_only=True,
    )
    destination_hospital_city = serializers.CharField(
        source='destination_hospital.city',
        read_only=True,
    )
    destination_hospital_latitude = serializers.DecimalField(
        source='destination_hospital.latitude',
        max_digits=9,
        decimal_places=6,
        read_only=True,
        allow_null=True,
    )
    destination_hospital_longitude = serializers.DecimalField(
        source='destination_hospital.longitude',
        max_digits=9,
        decimal_places=6,
        read_only=True,
        allow_null=True,
    )
    patient_name = serializers.SerializerMethodField()
    source_hospital = serializers.SerializerMethodField()
    patient_phone = serializers.CharField(source='patient.phone', read_only=True)
    dispatcher_name = serializers.SerializerMethodField()

    class Meta:
        model = AmbulanceRequest
        fields = (
            'id',
            'patient',
            'patient_name',
            'patient_phone',
            'destination_hospital',
            'destination_hospital_name',
            'destination_hospital_city',
            'destination_hospital_latitude',
            'destination_hospital_longitude',
            'source_hospital',
            'pickup_address',
            'pickup_latitude',
            'pickup_longitude',
            'patient_notes',
            'status',
            'ambulance_code',
            'dispatcher',
            'dispatcher_name',
            'ambulance_latitude',
            'ambulance_longitude',
            'eta_minutes',
            'requested_at',
            'updated_at',
            'dispatched_at',
            'arrived_at',
            'completed_at',
            'cancelled_at',
        )
        read_only_fields = (
            'id',
            'patient',
            'status',
            'ambulance_code',
            'dispatcher',
            'ambulance_latitude',
            'ambulance_longitude',
            'eta_minutes',
            'requested_at',
            'updated_at',
            'dispatched_at',
            'arrived_at',
            'completed_at',
            'cancelled_at',
        )

    def get_patient_name(self, obj):
        return obj.patient.get_full_name() or obj.patient.email

    def get_source_hospital(self, obj):
        try:
            hospital = obj.interfacility_referral.source_hospital
        except InterfacilityReferral.DoesNotExist:
            return None
        return {
            'id': hospital.pk,
            'name': hospital.name,
            'latitude': hospital.latitude,
            'longitude': hospital.longitude,
        }

    def get_dispatcher_name(self, obj):
        if not obj.dispatcher:
            return ''
        return obj.dispatcher.get_full_name() or obj.dispatcher.email


class AmbulanceDispatchSerializer(serializers.Serializer):
    ambulance_code = serializers.CharField(max_length=100)
    latitude = serializers.DecimalField(
        max_digits=9,
        decimal_places=6,
        min_value=Decimal('-90'),
        max_value=Decimal('90'),
    )
    longitude = serializers.DecimalField(
        max_digits=9,
        decimal_places=6,
        min_value=Decimal('-180'),
        max_value=Decimal('180'),
    )
    eta_minutes = serializers.IntegerField(min_value=0, max_value=1440)


class AmbulanceLocationSerializer(serializers.Serializer):
    latitude = serializers.DecimalField(
        max_digits=9,
        decimal_places=6,
        min_value=Decimal('-90'),
        max_value=Decimal('90'),
    )
    longitude = serializers.DecimalField(
        max_digits=9,
        decimal_places=6,
        min_value=Decimal('-180'),
        max_value=Decimal('180'),
    )
    eta_minutes = serializers.IntegerField(min_value=0, max_value=1440, required=False)


class AmbulanceStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=AmbulanceRequest.Status.choices)


class ReferralVitalsSerializer(serializers.Serializer):
    systolic_bp = serializers.IntegerField(min_value=0, max_value=300, required=False)
    diastolic_bp = serializers.IntegerField(min_value=0, max_value=200, required=False)
    heart_rate = serializers.IntegerField(min_value=0, max_value=300, required=False)
    respiratory_rate = serializers.IntegerField(min_value=0, max_value=100, required=False)
    temperature_celsius = serializers.DecimalField(
        max_digits=4,
        decimal_places=1,
        min_value=Decimal('25'),
        max_value=Decimal('50'),
        required=False,
    )
    oxygen_saturation_pct = serializers.IntegerField(min_value=0, max_value=100, required=False)

    def to_internal_value(self, data):
        if not isinstance(data, dict):
            return super().to_internal_value(data)
        unknown_fields = set(data) - set(self.fields)
        if unknown_fields:
            raise serializers.ValidationError({
                field: 'Unknown vital sign.' for field in sorted(unknown_fields)
            })
        return super().to_internal_value(data)

    def validate(self, attrs):
        if 'temperature_celsius' in attrs:
            attrs['temperature_celsius'] = float(attrs['temperature_celsius'])
        return attrs


class InterfacilityReferralSerializer(serializers.ModelSerializer):
    source_hospital = serializers.PrimaryKeyRelatedField(
        queryset=Hospital.objects.filter(is_active=True),
    )
    receiving_hospital = serializers.PrimaryKeyRelatedField(
        queryset=Hospital.objects.filter(is_active=True),
    )
    patient = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
    )
    resource_type = serializers.PrimaryKeyRelatedField(
        queryset=ResourceType.objects.filter(is_active=True),
    )
    resource_quantity = serializers.IntegerField(min_value=1)
    vitals = ReferralVitalsSerializer(required=False)
    source_hospital_name = serializers.CharField(source='source_hospital.name', read_only=True)
    receiving_hospital_name = serializers.CharField(source='receiving_hospital.name', read_only=True)
    patient_name = serializers.SerializerMethodField()
    resource_type_name = serializers.CharField(source='resource_type.name', read_only=True)
    ambulance_request_status = serializers.CharField(
        source='ambulance_request.status',
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = InterfacilityReferral
        fields = (
            'id',
            'source_hospital',
            'source_hospital_name',
            'receiving_hospital',
            'receiving_hospital_name',
            'patient',
            'patient_name',
            'presenting_concern',
            'acuity',
            'vitals',
            'interventions',
            'resource_type',
            'resource_type_name',
            'resource_quantity',
            'status',
            'ambulance_request',
            'ambulance_request_status',
            'reservation_transaction',
            'referred_by',
            'accepted_by',
            'created_at',
            'updated_at',
            'accepted_at',
        )
        read_only_fields = (
            'id',
            'status',
            'ambulance_request',
            'ambulance_request_status',
            'reservation_transaction',
            'referred_by',
            'accepted_by',
            'created_at',
            'updated_at',
            'accepted_at',
        )

    def validate(self, attrs):
        if attrs['source_hospital'].pk == attrs['receiving_hospital'].pk:
            raise serializers.ValidationError({
                'receiving_hospital': 'Choose a different receiving hospital.'
            })
        if attrs['patient'].role != 'PATIENT':
            raise serializers.ValidationError({'patient': 'The referred user must be a patient.'})
        user = self.context['request'].user
        if user.role not in {'NURSE', 'STAFF'} or not HospitalStaff.objects.filter(
            user=user,
            hospital=attrs['source_hospital'],
            is_active=True,
        ).exists():
            raise serializers.ValidationError({
                'source_hospital': 'Only an active nurse or staff member at the source hospital can refer.'
            })
        return attrs

    def get_patient_name(self, obj):
        return obj.patient.get_full_name() or obj.patient.email
