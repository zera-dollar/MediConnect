from rest_framework import serializers
from .models import Hospital, Department, HospitalStaff
from accounts.serializers import UserSerializer


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = (
            'id', 'name', 'description', 'head_of_department',
            'is_active', 'hospital',
        )
        read_only_fields = ('id',)


class HospitalSerializer(serializers.ModelSerializer):
    departments = DepartmentSerializer(many=True, read_only=True)
    departments_count = serializers.SerializerMethodField()

    class Meta:
        model = Hospital
        fields = (
            'id', 'name', 'registration_number', 'master_facility_code',
            'facility_level', 'ownership_type', 'county', 'sub_county',
            'county_rank', 'sub_county_rank', 'address', 'city',
            'state', 'country', 'postal_code', 'phone', 'email',
            'website', 'logo', 'description', 'is_active',
            'latitude', 'longitude', 'created_at', 'updated_at',
            'departments', 'departments_count',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def get_departments_count(self, obj):
        return obj.departments.filter(is_active=True).count()


class HospitalListSerializer(serializers.ModelSerializer):
    """Lighter serializer for list views."""
    class Meta:
        model = Hospital
        fields = (
            'id', 'name', 'master_facility_code', 'facility_level',
            'ownership_type', 'county', 'sub_county', 'county_rank',
            'sub_county_rank', 'city', 'country', 'phone', 'email',
            'logo', 'is_active', 'latitude', 'longitude',
        )


class HospitalStaffSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=__import__('django.contrib.auth', fromlist=['get_user_model']).get_user_model().objects.all(),
        source='user',
        write_only=True
    )
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)

    class Meta:
        model = HospitalStaff
        fields = (
            'id', 'user', 'user_id', 'hospital', 'hospital_name',
            'department', 'role_at_hospital', 'is_primary',
            'joined_at', 'is_active',
        )
        read_only_fields = ('id', 'joined_at')
