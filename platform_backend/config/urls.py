from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)


def api_root(_request):
    return JsonResponse({
        'service': 'MediConnect API',
        'docs': '/api/docs/',
        'schema': '/api/schema/',
    })


urlpatterns = [
    path('', api_root, name='api-root'),
    path('admin/', admin.site.urls),
    # API
    path('api/auth/', include('accounts.urls')),
    path('api/', include('hospitals.urls')),
    path('api/', include('contracts.urls')),
    path('api/resources/', include('resources.urls')),
    path('api/ambulance/', include('ambulances.urls')),
    path('api/appointments/', include('appointments.urls')),
    path('api/', include('activity_ledger.urls')),
    path('api/driver-telemetry/', include('driver_telemetry.urls')),
    path('api/integrations/', include('integrations.urls')),
    path('api/', include('notifications.urls')),
    # OpenAPI schema & docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
