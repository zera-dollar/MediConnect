from dataclasses import dataclass

from django.conf import settings


class MpesaConfigurationError(RuntimeError):
    pass


@dataclass(frozen=True)
class MpesaConfiguration:
    environment: str
    consumer_key: str
    consumer_secret: str
    shortcode: str
    passkey: str
    payments_enabled: bool

    @classmethod
    def from_settings(cls):
        return cls(
            environment=settings.MPESA_ENVIRONMENT,
            consumer_key=settings.MPESA_CONSUMER_KEY,
            consumer_secret=settings.MPESA_CONSUMER_SECRET,
            shortcode=settings.MPESA_SHORTCODE,
            passkey=settings.MPESA_PASSKEY,
            payments_enabled=settings.MPESA_PAYMENTS_ENABLED,
        )

    @property
    def is_configured(self):
        return all((
            self.environment in {'sandbox', 'production'},
            self.consumer_key,
            self.consumer_secret,
            self.shortcode,
            self.passkey,
        ))


class MpesaAdapter:
    """Credential/configuration boundary; checkout is intentionally disabled in this MVP."""

    def __init__(self, configuration=None):
        self.configuration = configuration or MpesaConfiguration.from_settings()

    @property
    def ready_for_sandbox(self):
        return self.configuration.environment == 'sandbox' and self.configuration.is_configured

    def assert_checkout_enabled(self):
        if not self.configuration.payments_enabled:
            raise MpesaConfigurationError('M-Pesa checkout is disabled; no payments are accepted in this MVP.')
        if not self.configuration.is_configured:
            raise MpesaConfigurationError('M-Pesa Daraja credentials are incomplete.')
        if self.configuration.environment != 'sandbox':
            raise MpesaConfigurationError('Production M-Pesa checkout is not enabled by this MVP.')
