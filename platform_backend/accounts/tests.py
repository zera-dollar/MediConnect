from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from types import SimpleNamespace
from unittest.mock import patch
from rest_framework.test import APITestCase

from .models import ProfessionalDocument
from .tasks import verify_professional_document


User = get_user_model()


class PatientRegistrationTests(APITestCase):
    def test_patient_can_self_register(self):
        response = self.client.post('/api/auth/register/', {
            'email': 'patient@example.test',
            'password': 'Strong-test-password-752!',
            'password_confirm': 'Strong-test-password-752!',
            'first_name': 'Test',
            'last_name': 'Patient',
            'role': User.Role.PATIENT,
            'phone': '+254700000000',
        })

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email='patient@example.test')
        self.assertEqual(user.role, User.Role.PATIENT)
        self.assertTrue(user.check_password('Strong-test-password-752!'))


class ProfessionalVerificationTests(APITestCase):
    def setUp(self):
        self.professional = User.objects.create_user(
            email='doctor@example.test',
            password='SafePassword123!',
            role=User.Role.DOCTOR,
        )
        self.client.force_authenticate(self.professional)

    def test_document_upload_queues_verification_and_ignores_client_verification_flags(self):
        with patch('accounts.views.verify_professional_document.delay') as enqueue:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    '/api/auth/documents/',
                    {
                        'document_type': 'LICENSE',
                        'file': SimpleUploadedFile('license.txt', b'license details'),
                        'is_verified': True,
                        'verification_status': 'VERIFIED',
                    },
                    format='multipart',
                )

        self.assertEqual(response.status_code, 201)
        document = ProfessionalDocument.objects.get()
        self.professional.refresh_from_db()
        self.assertEqual(document.verification_status, User.VerificationStatus.PENDING)
        self.assertEqual(self.professional.verification_status, User.VerificationStatus.PENDING)
        self.assertFalse(self.professional.is_verified)
        self.assertFalse(document.is_verified)
        enqueue.assert_called_once_with(document.pk)

    def test_verification_task_stays_pending_without_external_access(self):
        document = ProfessionalDocument.objects.create(
            user=self.professional,
            document_type='LICENSE',
            file=SimpleUploadedFile('license.txt', b'license details'),
        )

        result = verify_professional_document(document.pk)

        self.professional.refresh_from_db()
        document.refresh_from_db()
        self.assertEqual(result, User.VerificationStatus.PENDING_EXTERNAL_ACCESS)
        self.assertEqual(
            self.professional.verification_status,
            User.VerificationStatus.PENDING_EXTERNAL_ACCESS,
        )
        self.assertEqual(
            document.verification_status,
            User.VerificationStatus.PENDING_EXTERNAL_ACCESS,
        )
        self.assertFalse(self.professional.is_verified)

    @patch(
        'accounts.tasks.verify_professional_credentials',
        return_value=SimpleNamespace(status=User.VerificationStatus.VERIFIED),
    )
    def test_task_never_trusts_a_provider_result_to_grant_verification(self, verify):
        document = ProfessionalDocument.objects.create(
            user=self.professional,
            document_type='LICENSE',
            file=SimpleUploadedFile('license.txt', b'license details'),
        )

        result = verify_professional_document(document.pk)

        self.professional.refresh_from_db()
        self.assertEqual(result, User.VerificationStatus.PENDING_EXTERNAL_ACCESS)
        self.assertFalse(self.professional.is_verified)
        self.assertEqual(
            self.professional.verification_status,
            User.VerificationStatus.PENDING_EXTERNAL_ACCESS,
        )
        verify.assert_called_once()

    def test_profile_update_cannot_set_verification_flags(self):
        response = self.client.patch(
            '/api/auth/profile/',
            {'is_verified': True, 'verification_status': 'VERIFIED'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.professional.refresh_from_db()
        self.assertFalse(self.professional.is_verified)
        self.assertEqual(
            self.professional.verification_status,
            User.VerificationStatus.NOT_SUBMITTED,
        )
