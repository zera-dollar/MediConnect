from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .models import ProfessionalDocument

User = get_user_model()


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = (
            'id', 'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'role', 'phone',
            'license_number', 'specialization', 'years_of_experience',
            'bio', 'preferred_locations',
        )
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True},
            'role': {'required': True},
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        # Prevent self-registration as ADMIN or HOSPITAL_ADMIN without extra checks
        if attrs.get('role') in (User.Role.ADMIN, User.Role.HOSPITAL_ADMIN):
            raise serializers.ValidationError({
                "role": "Cannot self-register as Admin. Contact support."
            })
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'phone', 'license_number', 'specialization',
            'years_of_experience', 'bio', 'profile_picture',
            'is_verified', 'verification_status', 'preferred_locations',
            'availability_status',
            'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'email', 'is_verified', 'verification_status',
            'created_at', 'updated_at',
        )

    def get_full_name(self, obj):
        return obj.get_full_name()


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            'first_name', 'last_name', 'phone', 'license_number',
            'specialization', 'years_of_experience', 'bio',
            'profile_picture', 'preferred_locations', 'availability_status',
        )


class ProfessionalDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProfessionalDocument
        fields = (
            'id', 'document_type', 'file', 'description',
            'uploaded_at', 'is_verified', 'verification_status',
        )
        read_only_fields = (
            'id', 'uploaded_at', 'is_verified', 'verification_status',
        )


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({"new_password": "Password fields didn't match."})
        return attrs
