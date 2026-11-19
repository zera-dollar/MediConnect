from django.urls import path

from .views import AppointmentListCreateView, HealthcareProfessionalListView


urlpatterns = [
    path('professionals/', HealthcareProfessionalListView.as_view(), name='appointment-professionals'),
    path('bookings/', AppointmentListCreateView.as_view(), name='appointment-bookings'),
]
