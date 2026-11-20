from rest_framework.routers import DefaultRouter

from .views import AmbulanceRequestViewSet, InterfacilityReferralViewSet

router = DefaultRouter()
router.register('requests', AmbulanceRequestViewSet, basename='ambulance-request')
router.register('referrals', InterfacilityReferralViewSet, basename='interfacility-referral')

urlpatterns = router.urls
