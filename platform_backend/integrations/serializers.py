from rest_framework import serializers

from .models import OfflineResourceUpdate


class InboundSMSSerializer(serializers.Serializer):
    sender = serializers.CharField(max_length=30)
    message = serializers.CharField(max_length=200)
    provider_message_id = serializers.CharField(max_length=150)


class InboundUSSDSerializer(serializers.Serializer):
    sender = serializers.CharField(max_length=30)
    message = serializers.CharField(max_length=200)
    session_id = serializers.CharField(max_length=150)


class OfflineResourceUpdateSerializer(serializers.ModelSerializer):
    idempotency_key = serializers.UUIDField()

    class Meta:
        model = OfflineResourceUpdate
        fields = (
            'idempotency_key',
            'hospital_resource',
            'expected_last_updated',
            'available_quantity',
            'status',
            'previous_available',
            'detail',
            'created_at',
            'applied_at',
        )
        read_only_fields = ('status', 'previous_available', 'detail', 'created_at', 'applied_at')
