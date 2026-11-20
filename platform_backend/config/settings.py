"""
Django settings for Healthcare Platform (MediConnect / HealthStaff Hub).
"""

from pathlib import Path
from datetime import timedelta
import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-change-me-in-production-4sro$tc2yr6h&v2r#x%tqkqerfc6meu8e=e6+q)$rlf)xitxv5')

DEBUG = os.getenv('DEBUG', 'True').lower() in ('true', '1', 'yes')

ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
    if host.strip()
]
VERCEL_BACKEND_HOST = 'https://platformbackend-b6shqbo8e-isaacs-projects-162172f6.vercel.app/'
if VERCEL_BACKEND_HOST not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(VERCEL_BACKEND_HOST)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'drf_spectacular',
    # Local apps
    'accounts',
    'hospitals',
    'contracts',
    'resources',
    'notifications',
    'ambulances',
    'appointments',
    'activity_ledger',
    'driver_telemetry',
    'integrations',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'activity_ledger.middleware.ActivityLedgerMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

REDIS_URL = os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/0')
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {'hosts': [REDIS_URL]},
    },
}

CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', REDIS_URL)
CELERY_TIMEZONE = os.getenv('TIME_ZONE', 'UTC')
CELERY_BEAT_SCHEDULE = {
    'snapshot-hospital-resources-hourly': {
        'task': 'resources.tasks.snapshot_hospital_resources',
        'schedule': 3600.0,
    },
}

MPESA_ENVIRONMENT = os.getenv('MPESA_ENVIRONMENT', 'sandbox')
MPESA_CONSUMER_KEY = os.getenv('MPESA_CONSUMER_KEY', '')
MPESA_CONSUMER_SECRET = os.getenv('MPESA_CONSUMER_SECRET', '')
MPESA_SHORTCODE = os.getenv('MPESA_SHORTCODE', '')
MPESA_PASSKEY = os.getenv('MPESA_PASSKEY', '')
MPESA_PAYMENTS_ENABLED = os.getenv('MPESA_PAYMENTS_ENABLED', 'false').lower() == 'true'
FRONTEND_BASE_URL = os.getenv('FRONTEND_BASE_URL', 'http://127.0.0.1:5173')

SMS_WEBHOOK_TOKEN = os.getenv('SMS_WEBHOOK_TOKEN', '')
USSD_WEBHOOK_TOKEN = os.getenv('USSD_WEBHOOK_TOKEN', '')
SMS_GATEWAY_URL = os.getenv('SMS_GATEWAY_URL', '')
SMS_GATEWAY_TOKEN = os.getenv('SMS_GATEWAY_TOKEN', '')

KMPDC_API_BASE_URL = os.getenv('KMPDC_API_BASE_URL', '')
KMPDC_API_TOKEN = os.getenv('KMPDC_API_TOKEN', '')

DATABASES = {
    'default': {
        'ENGINE': os.getenv('DB_ENGINE', 'django.db.backends.sqlite3'),
        'NAME': os.getenv('DB_NAME', str(BASE_DIR / 'db.sqlite3')),
        'USER': os.getenv('DB_USER', ''),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST': os.getenv('DB_HOST', ''),
        'PORT': os.getenv('DB_PORT', ''),
        'CONN_MAX_AGE': int(os.getenv('DB_CONN_MAX_AGE', '60')),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom User Model
AUTH_USER_MODEL = 'accounts.User'

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': [
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/day',
        'user': '1000/day',
    },
}

# Simple JWT
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:3000,http://127.0.0.1:3000',
    ).split(',')
    if origin.strip()
]
VERCEL_FRONTEND_ORIGIN = 'https://platformfrontend-delta.vercel.app'
if VERCEL_FRONTEND_ORIGIN not in CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS.append(VERCEL_FRONTEND_ORIGIN)

# Spectacular (OpenAPI / Swagger)
SPECTACULAR_SETTINGS = {
    'TITLE': 'Healthcare Staffing & Resource Platform API',
    'DESCRIPTION': '''
    Complete REST API for a healthcare platform that enables:
    - Doctors, nurses and other health professionals to view & bid on work contracts
    - Hospitals to post shifts / contracts and manage staffing
    - Real-time tracking of bed availability, blood stock, oxygen, medications and other critical resources
    ''',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
}

# Email (for notifications – configure in production)
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'noreply@healthcareplatform.local')
