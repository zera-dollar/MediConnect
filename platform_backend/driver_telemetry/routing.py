from django.urls import path

from .consumers import DriverLocationConsumer, LocationViewerConsumer

websocket_urlpatterns = [
    path('ws/driver-telemetry/driver/', DriverLocationConsumer.as_asgi()),
    path('ws/driver-telemetry/ambulance/<int:request_id>/', LocationViewerConsumer.as_asgi()),
]
