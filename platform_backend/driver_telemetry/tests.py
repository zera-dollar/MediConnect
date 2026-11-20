import hashlib
from decimal import Decimal

from asgiref.sync import async_to_sync
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient

from accounts.models import User
from ambulances.models import AmbulanceRequest, InterfacilityReferral
from hospitals.models import Hospital, HospitalStaff
from resources.models import ResourceCategory, ResourceType
from .consumers import LocationViewerConsumer
from .models import DriverTelemetrySession


class DriverTelemetrySessionApiTests(APITestCase):
    def setUp(self):
        self.dispatcher = User.objects.create_user(
            email='dispatcher@example.com',
            password='test-password',
            role=User.Role.HOSPITAL_ADMIN,
        )
        self.patient = User.objects.create_user(
            email='patient@example.com',
            password='test-password',
            role=User.Role.PATIENT,
        )
        self.hospital = Hospital.objects.create(
            name='North Hospital',
            registration_number='HOSP-TELEMETRY',
            address='Main Road',
            city='Nairobi',
            phone='+254700000001',
            email='north@example.com',
        )
        HospitalStaff.objects.create(
            user=self.dispatcher,
            hospital=self.hospital,
            role_at_hospital='ADMIN',
            is_active=True,
        )
        self.source_hospital = Hospital.objects.create(
            name='Source Hospital',
            registration_number='HOSP-TELEMETRY-SOURCE',
            address='Source Road',
            city='Nairobi',
            phone='+254700000002',
            email='source@example.com',
        )
        self.source_nurse = User.objects.create_user(
            email='source-nurse@example.com',
            password='test-password',
            role=User.Role.NURSE,
        )
        HospitalStaff.objects.create(
            user=self.source_nurse,
            hospital=self.source_hospital,
            role_at_hospital='STAFF',
            is_active=True,
        )
        self.ambulance_request = AmbulanceRequest.objects.create(
            patient=self.patient,
            destination_hospital=self.hospital,
            pickup_address='Central Road',
            pickup_latitude=Decimal('-1.286389'),
            pickup_longitude=Decimal('36.817223'),
            status=AmbulanceRequest.Status.EN_ROUTE,
        )

    def test_dispatcher_creates_a_single_use_link_and_driver_exchanges_it_once(self):
        self.client.force_authenticate(self.dispatcher)
        response = self.client.post(
            '/api/driver-telemetry/sessions/',
            {'ambulance_request_id': self.ambulance_request.pk},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        driver_url = response.data['driver_url']
        link_token = driver_url.rsplit('/', 1)[-1]
        session = DriverTelemetrySession.objects.get(ambulance_request=self.ambulance_request)
        self.assertEqual(session.link_token_hash, hashlib.sha256(link_token.encode()).hexdigest())
        self.assertIsNone(session.link_used_at)

        driver_client = APIClient()
        exchange = driver_client.post(
            '/api/driver-telemetry/exchange/',
            {'link_token': link_token},
            format='json',
        )
        self.assertEqual(exchange.status_code, 200)
        self.assertTrue(exchange.data['access_token'])
        self.assertIsNotNone(session.__class__.objects.get(pk=session.pk).link_used_at)

        repeat = driver_client.post(
            '/api/driver-telemetry/exchange/',
            {'link_token': link_token},
            format='json',
        )
        self.assertEqual(repeat.status_code, 400)

    def test_non_dispatcher_cannot_create_a_driver_link(self):
        self.client.force_authenticate(self.patient)
        response = self.client.post(
            '/api/driver-telemetry/sessions/',
            {'ambulance_request_id': self.ambulance_request.pk},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_link_cannot_be_created_before_dispatch(self):
        self.ambulance_request.status = AmbulanceRequest.Status.REQUESTED
        self.ambulance_request.save(update_fields=['status'])
        self.client.force_authenticate(self.dispatcher)
        response = self.client.post(
            '/api/driver-telemetry/sessions/',
            {'ambulance_request_id': self.ambulance_request.pk},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_referring_facility_staff_can_view_live_telemetry(self):
        resource_type = ResourceType.objects.create(
            category=ResourceCategory.objects.create(
                name='Telemetry Beds',
                slug='telemetry-beds',
            ),
            name='Telemetry Bed',
        )
        InterfacilityReferral.objects.create(
            source_hospital=self.source_hospital,
            receiving_hospital=self.hospital,
            patient=self.patient,
            referred_by=self.source_nurse,
            presenting_concern='Transfer handoff',
            acuity=InterfacilityReferral.Acuity.URGENT,
            resource_type=resource_type,
            resource_quantity=1,
            ambulance_request=self.ambulance_request,
        )
        consumer = LocationViewerConsumer()
        consumer.request_id = self.ambulance_request.pk

        may_view = async_to_sync(consumer._may_view)

        self.assertTrue(may_view(self.source_nurse.pk))
        self.assertTrue(may_view(self.dispatcher.pk))
        self.assertFalse(may_view(User.objects.create_user(
            email='unrelated-viewer@example.com',
            password='test-password',
            role=User.Role.STAFF,
        ).pk))
