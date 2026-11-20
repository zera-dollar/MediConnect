from dataclasses import dataclass

from .models import User


@dataclass(frozen=True)
class CredentialVerificationResult:
    status: str
    detail: str


def verify_professional_credentials(user, document):
    """Return a safe pending result until an authorized registry integration exists."""
    return CredentialVerificationResult(
        status=User.VerificationStatus.PENDING_EXTERNAL_ACCESS,
        detail='KMPDC verification is pending authorized provider access.',
    )
