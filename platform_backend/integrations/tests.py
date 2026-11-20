from datetime import timedelta
from uuid import uuid4

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from hospitals.models import Hospital, HospitalStaff
from resources.models import (
    HospitalResource,
    ResourceCategory,
    ResourceTransaction,
    ResourceType,
)
from .models import InboundSMS, OfflineResourceUpdate
from .mpesa import MpesaAdapter, MpesaConfiguration, MpesaConfigurationError


class IntegrationApiTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(
            email='integration-manager@example.test',
            password='TestPass123!',
            role=User.Role.HOSPITAL_ADMIN,
            phone='+254700000001',
        )
        self.hospital = Hospital.objects.create(
            name='Integration Hospital',
            registration_number='INTEGRATION-001',
            master_facility_code='MFL-INT-001',
            address='1 Integration Road',
            city='Nairobi',
            phone='+254700000002',
            email='integration-hospital@example.test',
        )
        HospitalStaff.objects.create(
            user=self.manager,
            hospital=self.hospital,
            role_at_hospital='MANAGER',
        )
        category = ResourceCategory.objects.create(name='Beds', slug='integration-beds')
        resource_type = ResourceType.objects.create(category=category, name='ICU Bed')
        self.resource = HospitalResource.objects.create(
            hospital=self.hospital,
            resource_type=resource_type,
            total_capacity=20,
            available_quantity=5,
            reserved_quantity=0,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.manager)

    @override_settings(SMS_WEBHOOK_TOKEN='webhook-test-token')
    def test_inbound_sms_requires_the_configured_webhook_token(self):
        response = self.client.post(
            '/api/integrations/sms/inbound/',
            {
                'sender': self.manager.phone,
                'message': f'BED MFL-INT-001 {self.resource.pk} 4',
                'provider_message_id': 'unauthorized-provider-message',
            },
            format='json',
            HTTP_X_WEBHOOK_TOKEN='wrong-token',
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(InboundSMS.objects.exists())
        self.resource.refresh_from_db()
        self.assertEqual(self.resource.available_quantity, 5)

    @override_settings(SMS_WEBHOOK_TOKEN='webhook-test-token')
    def test_inbound_sms_updates_a_bed_count_once_per_provider_message(self):
        payload = {
            'sender': self.manager.phone,
            'message': f'BED MFL-INT-001 {self.resource.pk} 4',
            'provider_message_id': 'provider-message-001',
        }

        first = self.client.post(
            '/api/integrations/sms/inbound/',
            payload,
            format='json',
            HTTP_X_WEBHOOK_TOKEN='webhook-test-token',
        )
        second = self.client.post(
            '/api/integrations/sms/inbound/',
            payload,
            format='json',
            HTTP_X_WEBHOOK_TOKEN='webhook-test-token',
        )

        self.resource.refresh_from_db()
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data['status'], 'processed')
        self.assertEqual(second.data, first.data)
        self.assertEqual(self.resource.available_quantity, 4)
        self.assertEqual(InboundSMS.objects.count(), 1)
        self.assertEqual(ResourceTransaction.objects.count(), 1)

    @override_settings(USSD_WEBHOOK_TOKEN='ussd-test-token')
    def test_inbound_ussd_ends_after_a_single_idempotent_resource_update(self):
        payload = {
            'sender': self.manager.phone,
            'message': f'BED MFL-INT-001 {self.resource.pk} 2',
            'session_id': 'ussd-session-001',
        }

        first = self.client.post(
            '/api/integrations/ussd/callback/',
            payload,
            format='json',
            HTTP_X_WEBHOOK_TOKEN='ussd-test-token',
        )
        repeated = self.client.post(
            '/api/integrations/ussd/callback/',
            payload,
            format='json',
            HTTP_X_WEBHOOK_TOKEN='ussd-test-token',
        )

        self.resource.refresh_from_db()
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data['action'], 'END')
        self.assertEqual(first.data['status'], 'processed')
        self.assertEqual(repeated.data, first.data)
        self.assertEqual(self.resource.available_quantity, 2)
        self.assertEqual(InboundSMS.objects.filter(provider='ussd').count(), 1)
        self.assertEqual(ResourceTransaction.objects.count(), 1)

    def test_offline_update_is_idempotent_and_rejects_stale_values(self):
        key = str(uuid4())
        payload = {
            'idempotency_key': key,
            'hospital_resource': self.resource.pk,
            'expected_last_updated': self.resource.last_updated.isoformat(),
            'available_quantity': 3,
        }

        first = self.client.post(
            '/api/integrations/resources/offline-updates/',
            payload,
            format='json',
        )
        duplicate = self.client.post(
            '/api/integrations/resources/offline-updates/',
            payload,
            format='json',
        )

        self.resource.refresh_from_db()
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data['status'], OfflineResourceUpdate.Status.APPLIED)
        self.assertEqual(duplicate.data, first.data)
        self.assertEqual(self.resource.available_quantity, 3)
        self.assertEqual(OfflineResourceUpdate.objects.count(), 1)
        self.assertEqual(ResourceTransaction.objects.count(), 1)

        stale = self.client.post(
            '/api/integrations/resources/offline-updates/',
            {
                'idempotency_key': str(uuid4()),
                'hospital_resource': self.resource.pk,
                'expected_last_updated': (timezone.now() - timedelta(hours=1)).isoformat(),
                'available_quantity': 2,
            },
            format='json',
        )

        self.assertEqual(stale.status_code, 409)
        self.assertEqual(stale.data['status'], OfflineResourceUpdate.Status.CONFLICT)
        self.resource.refresh_from_db()
        self.assertEqual(self.resource.available_quantity, 3)

    def test_offline_idempotency_key_cannot_be_reused_for_another_payload(self):
        payload = {
            'idempotency_key': str(uuid4()),
            'hospital_resource': self.resource.pk,
            'expected_last_updated': self.resource.last_updated.isoformat(),
            'available_quantity': 3,
        }
        self.assertEqual(
            self.client.post(
                '/api/integrations/resources/offline-updates/',
                payload,
                format='json',
            ).status_code,
            200,
        )
        payload['available_quantity'] = 4

        response = self.client.post(
            '/api/integrations/resources/offline-updates/',
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('idempotency_key', response.data)


class MpesaAdapterTests(TestCase):
    def test_checkout_remains_disabled_even_with_sandbox_credentials(self):
        adapter = MpesaAdapter(MpesaConfiguration(
            environment='sandbox',
            consumer_key='consumer-key',
            consumer_secret='consumer-secret',
            shortcode='123456',
            passkey='passkey',
            payments_enabled=False,
        ))

        with self.assertRaisesRegex(MpesaConfigurationError, 'disabled'):
            adapter.assert_checkout_enabled()
