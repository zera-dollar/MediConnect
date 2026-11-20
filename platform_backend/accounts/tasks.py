from celery import shared_task

from .credential_verification import verify_professional_credentials
from .models import ProfessionalDocument, User


@shared_task
def verify_professional_document(document_id):
    try:
        document = ProfessionalDocument.objects.select_related('user').get(pk=document_id)
    except ProfessionalDocument.DoesNotExist:
        return None

    user = document.user
    verify_professional_credentials(user, document)

    # External provider results are deliberately not allowed to grant verification.
    if not user.is_verified:
        document.verification_status = User.VerificationStatus.PENDING_EXTERNAL_ACCESS
        document.save(update_fields=['verification_status'])
        user.verification_status = User.VerificationStatus.PENDING_EXTERNAL_ACCESS
        user.save(update_fields=['verification_status', 'updated_at'])
    return User.VerificationStatus.PENDING_EXTERNAL_ACCESS
