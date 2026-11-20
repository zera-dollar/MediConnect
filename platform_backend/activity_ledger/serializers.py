from rest_framework import serializers

from .models import ActivityLedger


class ActivityLedgerSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityLedger
        fields = (
            'id',
            'user',
            'event_type',
            'resource_type',
            'resource_id',
            'method',
            'endpoint',
            'response_status',
            'created_at',
        )
        read_only_fields = fields
