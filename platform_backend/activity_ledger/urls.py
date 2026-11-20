from django.urls import path

from .views import ActivityLedgerListView


urlpatterns = [
    path('history/', ActivityLedgerListView.as_view(), name='user-history'),
    path('ledger/', ActivityLedgerListView.as_view(), name='activity-ledger'),
]
