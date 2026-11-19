from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Appointment


User = get_user_model()


class AppointmentApiTests(APITestCase):
    def setUp(self):
        self.patient = User.objects.create_user(
            email='patient@example.test',
            password='TestPass123!',
            first_name='Pat',
            last_name='Patient',
            role=User.Role.PATIENT,
            phone='+254700000000',
        )
        self.professional = User.objects.create_user(
            email='doctor@example.test',
            password='TestPass123!',
            first_name='Alex',
            last_name='Doctor',
            role=User.Role.DOCTOR,
            specialization='Cardiology',
        )
        self.start_datetime = (timezone.now() + timedelta(days=1)).isoformat()
        self.payload = {
            'professional': self.professional.pk,
            'patient_name': 'Pat Patient',
            'patient_email': self.patient.email,
            'patient_phone': '',
            'start_datetime': self.start_datetime,
            'duration_minutes': 30,
        }
        self.client.force_authenticate(self.patient)

    def test_patient_can_create_and_list_appointment_with_contact_details(self):
        response = self.client.post(
            '/api/appointments/bookings/',
            self.payload,
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['patient'], self.patient.pk)
        self.assertEqual(response.data['patient_name'], 'Pat Patient')
        self.assertEqual(response.data['patient_email'], self.patient.email)
        self.assertEqual(response.data['status'], Appointment.Status.REQUESTED)

        list_response = self.client.get('/api/appointments/bookings/')
        self.assertEqual(list_response.data['results'][0]['id'], response.data['id'])

    def test_patient_must_provide_email_or_phone(self):
        self.payload['patient_email'] = ''

        response = self.client.post(
            '/api/appointments/bookings/',
            self.payload,
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('patient_email', response.data)

    def test_patient_cannot_book_past_time_or_unavailable_professional(self):
        self.payload['start_datetime'] = (timezone.now() - timedelta(minutes=1)).isoformat()
        past_response = self.client.post(
            '/api/appointments/bookings/',
            self.payload,
            format='json',
        )
        self.assertEqual(past_response.status_code, 400)

        self.professional.availability_status = 'BUSY'
        self.professional.save(update_fields=['availability_status'])
        self.payload['start_datetime'] = (timezone.now() + timedelta(days=1)).isoformat()
        unavailable_response = self.client.post(
            '/api/appointments/bookings/',
            self.payload,
            format='json',
        )
        self.assertEqual(unavailable_response.status_code, 400)

    def test_non_patient_cannot_create_appointment(self):
        self.client.force_authenticate(self.professional)

        response = self.client.post(
            '/api/appointments/bookings/',
            self.payload,
            format='json',
        )

        self.assertEqual(response.status_code, 403)

    def test_professional_picker_only_lists_available_healthcare_professionals(self):
        unavailable = User.objects.create_user(
            email='busy-doctor@example.test',
            password='TestPass123!',
            role=User.Role.DOCTOR,
            availability_status='BUSY',
        )
        User.objects.create_user(
            email='staff@example.test',
            password='TestPass123!',
            role=User.Role.STAFF,
        )

        response = self.client.get('/api/appointments/professionals/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual([professional['id'] for professional in response.data['results']], [self.professional.pk])
        self.assertNotIn(unavailable.pk, [professional['id'] for professional in response.data['results']])
