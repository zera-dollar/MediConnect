from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import ActivityLedger


User = get_user_model()


class ActivityLedgerApiTests(APITestCase):
    def setUp(self):
        self.patient = User.objects.create_user(
            email='patient@example.test',
            password='TestPass123!',
            role=User.Role.PATIENT,
        )
        self.other_patient = User.objects.create_user(
            email='other@example.test',
            password='TestPass123!',
            role=User.Role.PATIENT,
        )
        self.admin = User.objects.create_user(
            email='admin@example.test',
            password='TestPass123!',
            role=User.Role.ADMIN,
        )

    def test_authenticated_api_updates_are_recorded_without_request_payload(self):
        self.client.force_authenticate(self.patient)

        response = self.client.patch(
            '/api/auth/profile/',
            {'first_name': 'Updated'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        entry = ActivityLedger.objects.get(user=self.patient)
        self.assertEqual(entry.event_type, ActivityLedger.EventType.UPDATE)
        self.assertEqual(entry.endpoint, '/api/auth/profile/')
        self.assertEqual(entry.resource_type, 'auth/profile')
        self.assertEqual(entry.response_status, 200)
        self.assertFalse(hasattr(entry, 'metadata'))

    def test_login_is_recorded_as_authentication_history(self):
        response = self.client.post(
            '/api/auth/login/',
            {'email': self.patient.email, 'password': 'TestPass123!'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        entry = ActivityLedger.objects.get(user=self.patient)
        self.assertEqual(entry.event_type, ActivityLedger.EventType.LOGIN)
        self.assertEqual(entry.endpoint, '/api/auth/login/')

    def test_registration_is_recorded_as_user_history(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'email': 'new-patient@example.test',
                'password': 'Breezy-Maple-Quasar-9472!',
                'password_confirm': 'Breezy-Maple-Quasar-9472!',
                'first_name': 'New',
                'last_name': 'Patient',
                'role': User.Role.PATIENT,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        entry = ActivityLedger.objects.get(user_id=response.data['id'])
        self.assertEqual(entry.event_type, ActivityLedger.EventType.REGISTER)

    def test_users_read_only_their_own_history_while_admins_can_read_all(self):
        own_entry = ActivityLedger.objects.create(
            user=self.patient,
            event_type=ActivityLedger.EventType.UPDATE,
            resource_type='auth/profile',
            method='PATCH',
            endpoint='/api/auth/profile/',
            response_status=200,
        )
        ActivityLedger.objects.create(
            user=self.other_patient,
            event_type=ActivityLedger.EventType.CREATE,
            resource_type='appointments/bookings',
            method='POST',
            endpoint='/api/appointments/bookings/',
            response_status=201,
        )
        self.client.force_authenticate(self.patient)

        history_response = self.client.get('/api/history/')
        ledger_response = self.client.get('/api/ledger/?user_id={}'.format(self.other_patient.pk))

        self.assertEqual([row['id'] for row in history_response.data['results']], [own_entry.pk])
        self.assertEqual([row['user'] for row in ledger_response.data['results']], [self.patient.pk])

        self.client.force_authenticate(self.admin)
        admin_response = self.client.get('/api/ledger/')
        filtered_response = self.client.get('/api/history/?user_id={}'.format(self.other_patient.pk))

        self.assertEqual(len(admin_response.data['results']), 2)
        self.assertEqual(filtered_response.data['results'][0]['user'], self.other_patient.pk)

    def test_ledger_endpoints_do_not_allow_writes_and_reads_are_not_logged(self):
        self.client.force_authenticate(self.patient)

        response = self.client.post('/api/ledger/', {}, format='json')
        self.assertEqual(response.status_code, 405)
        self.assertEqual(ActivityLedger.objects.count(), 0)

        response = self.client.get('/api/history/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(ActivityLedger.objects.count(), 0)
