from rest_framework import serializers


class CreateDriverSessionSerializer(serializers.Serializer):
    ambulance_request_id = serializers.IntegerField(min_value=1)


class ExchangeDriverLinkSerializer(serializers.Serializer):
    link_token = serializers.CharField(max_length=100)
