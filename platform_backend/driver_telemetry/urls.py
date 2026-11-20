from django.urls import path

from .views import DriverLinkExchangeView, DriverSessionCreateView

urlpatterns = [
    path('sessions/', DriverSessionCreateView.as_view(), name='driver-session-create'),
    path('exchange/', DriverLinkExchangeView.as_view(), name='driver-link-exchange'),
]
