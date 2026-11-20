from django.urls import path

from .views import InboundSMSView, InboundUSSDView, OfflineResourceUpdateView

urlpatterns = [
    path('sms/inbound/', InboundSMSView.as_view(), name='sms-inbound'),
    path('ussd/callback/', InboundUSSDView.as_view(), name='ussd-callback'),
    path('resources/offline-updates/', OfflineResourceUpdateView.as_view(), name='offline-resource-update'),
]
