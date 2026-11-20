from django.contrib.auth import get_user_model
from django.db import connection
from rest_framework.test import APITransactionTestCase, APITestCase

from hospitals.models import Hospital, HospitalStaff
from resources.models import (
    HospitalResource,
    ResourceCategory,
    ResourceTransaction,
    ResourceType,
)
from .models import AmbulanceRequest, InterfacilityReferral


User = get_user_model()


class AmbulanceRequestApiTests(APITestCase):
    def setUp(self):
        self.patient = User.objects.create_user(
            email='patient@example.test',
            password='TestPass123!',
            role=User.Role.PATIENT,
        )
        self.dispatcher = User.objects.create_user(
            email='dispatcher@example.test',
            password='TestPass123!',
            role=User.Role.HOSPITAL_ADMIN,
        )
        self.hospital = Hospital.objects.create(
            name='Demo Hospital',
            registration_number='TEST-AMB-001',
            address='1 Test Road',
            city='Nairobi',
            country='Kenya',
            phone='+254700000000',
            email='hospital@example.test',
            latitude=-1.2921,
            longitude=36.8219,
        )
        HospitalStaff.objects.create(
            user=self.dispatcher,
            hospital=self.hospital,
            role_at_hospital='COORDINATOR',
        )
        self.request_payload = {
            'destination_hospital': self.hospital.pk,
            'pickup_address': '1 Example Street, Nairobi',
            'pickup_latitude': '-1.280000',
            'pickup_longitude': '36.820000',
            'patient_notes': 'Demo request',
        }

    def test_patient_can_create_and_read_own_request(self):
        self.client.force_authenticate(self.patient)
        response = self.client.post(
            '/api/ambulance/requests/',
            self.request_payload,
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], AmbulanceRequest.Status.REQUESTED)
        self.assertEqual(response.data['patient'], self.patient.pk)
        self.assertEqual(
            self.client.get('/api/ambulance/requests/').data['results'][0]['id'],
            response.data['id'],
        )

    def test_destination_hospital_dispatcher_can_dispatch_and_update_status(self):
        ambulance_request = AmbulanceRequest.objects.create(
            patient=self.patient,
            destination_hospital=self.hospital,
            pickup_address='1 Example Street, Nairobi',
            pickup_latitude=-1.28,
            pickup_longitude=36.82,
        )
        self.client.force_authenticate(self.dispatcher)

        response = self.client.post(
            f'/api/ambulance/requests/{ambulance_request.pk}/dispatch/',
            {
                'ambulance_code': 'AMB-TEST-1',
                'latitude': '-1.290000',
                'longitude': '36.820000',
                'eta_minutes': 12,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], AmbulanceRequest.Status.EN_ROUTE)

        response = self.client.post(
            f'/api/ambulance/requests/{ambulance_request.pk}/status/',
            {'status': AmbulanceRequest.Status.ARRIVED},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], AmbulanceRequest.Status.ARRIVED)

    def test_patient_cannot_dispatch_or_read_another_patients_request(self):
        other_patient = User.objects.create_user(
            email='other@example.test',
            password='TestPass123!',
            role=User.Role.PATIENT,
        )
        ambulance_request = AmbulanceRequest.objects.create(
            patient=other_patient,
            destination_hospital=self.hospital,
            pickup_address='2 Example Street, Nairobi',
            pickup_latitude=-1.28,
            pickup_longitude=36.82,
        )
        self.client.force_authenticate(self.patient)

        response = self.client.post(
            f'/api/ambulance/requests/{ambulance_request.pk}/dispatch/',
            {
                'ambulance_code': 'AMB-TEST-1',
                'latitude': '-1.290000',
                'longitude': '36.820000',
                'eta_minutes': 12,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 404)


class InterfacilityReferralApiTests(APITransactionTestCase):
    _created_referral_table = False

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        if InterfacilityReferral._meta.db_table not in connection.introspection.table_names():
            with connection.schema_editor() as schema_editor:
                schema_editor.create_model(InterfacilityReferral)
            cls._created_referral_table = True

    @classmethod
    def tearDownClass(cls):
        if cls._created_referral_table:
            with connection.schema_editor() as schema_editor:
                schema_editor.delete_model(InterfacilityReferral)
        super().tearDownClass()

    def setUp(self):
        self.patient = User.objects.create_user(
            email='referral-patient@example.test',
            password='TestPass123!',
            role=User.Role.PATIENT,
        )
        self.source_nurse = User.objects.create_user(
            email='source-nurse@example.test',
            password='TestPass123!',
            role=User.Role.NURSE,
        )
        self.source_doctor = User.objects.create_user(
            email='source-doctor@example.test',
            password='TestPass123!',
            role=User.Role.DOCTOR,
        )
        self.receiver_staff = User.objects.create_user(
            email='receiver-staff@example.test',
            password='TestPass123!',
            role=User.Role.STAFF,
        )
        self.unrelated_staff = User.objects.create_user(
            email='unrelated-staff@example.test',
            password='TestPass123!',
            role=User.Role.STAFF,
        )
        self.platform_admin = User.objects.create_user(
            email='platform-admin@example.test',
            password='TestPass123!',
            role=User.Role.ADMIN,
        )
        self.source_hospital = Hospital.objects.create(
            name='Source Hospital',
            registration_number='TEST-REF-SOURCE',
            address='1 Source Road',
            city='Nairobi',
            country='Kenya',
            phone='+254700000001',
            email='source@example.test',
            latitude='-1.280000',
            longitude='36.820000',
        )
        self.receiving_hospital = Hospital.objects.create(
            name='Receiving Hospital',
            registration_number='TEST-REF-RECEIVING',
            address='2 Receiver Road',
            city='Nairobi',
            country='Kenya',
            phone='+254700000002',
            email='receiving@example.test',
            latitude='-1.290000',
            longitude='36.830000',
        )
        self.unrelated_hospital = Hospital.objects.create(
            name='Unrelated Hospital',
            registration_number='TEST-REF-UNRELATED',
            address='3 Other Road',
            city='Nairobi',
            country='Kenya',
            phone='+254700000003',
            email='other@example.test',
            latitude='-1.300000',
            longitude='36.840000',
        )
        HospitalStaff.objects.create(user=self.source_nurse, hospital=self.source_hospital)
        HospitalStaff.objects.create(user=self.source_doctor, hospital=self.source_hospital)
        HospitalStaff.objects.create(
            user=self.receiver_staff,
            hospital=self.receiving_hospital,
            role_at_hospital='MANAGER',
        )
        HospitalStaff.objects.create(user=self.unrelated_staff, hospital=self.unrelated_hospital)
        category = ResourceCategory.objects.create(name='Referral Beds', slug='referral-beds')
        self.resource_type = ResourceType.objects.create(
            category=category,
            name='Referral ICU Bed',
        )
        self.resource = HospitalResource.objects.create(
            hospital=self.receiving_hospital,
            resource_type=self.resource_type,
            total_capacity=10,
            available_quantity=5,
            reserved_quantity=0,
        )
        self.referral_payload = {
            'source_hospital': self.source_hospital.pk,
            'receiving_hospital': self.receiving_hospital.pk,
            'patient': self.patient.pk,
            'presenting_concern': 'Respiratory distress',
            'acuity': InterfacilityReferral.Acuity.URGENT,
            'vitals': {
                'systolic_bp': 118,
                'diastolic_bp': 76,
                'heart_rate': 110,
                'oxygen_saturation_pct': 88,
            },
            'interventions': 'Oxygen initiated',
            'resource_type': self.resource_type.pk,
            'resource_quantity': 2,
        }

    def _create_referral(self):
        self.client.force_authenticate(self.source_nurse)
        response = self.client.post(
            '/api/ambulance/referrals/',
            self.referral_payload,
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response.data['id']

    def test_create_does_not_reserve_and_rejects_unstructured_vitals(self):
        self.client.force_authenticate(self.source_nurse)
        invalid_payload = dict(self.referral_payload)
        invalid_payload['vitals'] = {'oxygen_saturation_pct': 88, 'pain_score': 8}
        response = self.client.post(
            '/api/ambulance/referrals/',
            invalid_payload,
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(InterfacilityReferral.objects.count(), 0)
        self.resource.refresh_from_db()
        self.assertEqual(self.resource.available_quantity, 5)
        self.assertEqual(ResourceTransaction.objects.count(), 0)

        response = self.client.post(
            '/api/ambulance/referrals/',
            self.referral_payload,
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.resource.refresh_from_db()
        self.assertEqual(response.data['status'], InterfacilityReferral.Status.PENDING)
        self.assertEqual(self.resource.available_quantity, 5)
        self.assertEqual(self.resource.reserved_quantity, 0)
        self.assertEqual(ResourceTransaction.objects.count(), 0)

    def test_referral_is_hidden_from_unrelated_staff(self):
        referral_id = self._create_referral()
        self.client.force_authenticate(self.unrelated_staff)

        self.assertEqual(self.client.get('/api/ambulance/referrals/').data['results'], [])
        self.assertEqual(
            self.client.get(f'/api/ambulance/referrals/{referral_id}/').status_code,
            404,
        )
        self.assertEqual(
            self.client.post(f'/api/ambulance/referrals/{referral_id}/accept/').status_code,
            404,
        )

    def test_receiving_regular_staff_cannot_accept_referral(self):
        referral_id = self._create_referral()
        HospitalStaff.objects.create(
            user=self.unrelated_staff,
            hospital=self.receiving_hospital,
            role_at_hospital='STAFF',
        )
        self.client.force_authenticate(self.unrelated_staff)

        response = self.client.post(f'/api/ambulance/referrals/{referral_id}/accept/')

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            InterfacilityReferral.objects.get(pk=referral_id).status,
            InterfacilityReferral.Status.PENDING,
        )
        self.resource.refresh_from_db()
        self.assertEqual(self.resource.available_quantity, 5)

        self.client.force_authenticate(self.receiver_staff)
        response = self.client.get(f'/api/ambulance/referrals/{referral_id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['presenting_concern'], 'Respiratory distress')

        self.client.force_authenticate(self.platform_admin)
        self.assertEqual(self.client.get('/api/ambulance/referrals/').data['count'], 1)

    def test_only_active_source_nurses_or_staff_can_create_referrals(self):
        self.client.force_authenticate(self.source_doctor)

        response = self.client.post(
            '/api/ambulance/referrals/',
            self.referral_payload,
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(InterfacilityReferral.objects.count(), 0)

    def test_accept_atomically_reserves_resource_and_creates_ambulance_request_once(self):
        referral_id = self._create_referral()
        self.client.force_authenticate(self.receiver_staff)

        response = self.client.post(f'/api/ambulance/referrals/{referral_id}/accept/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], InterfacilityReferral.Status.ACCEPTED)
        self.resource.refresh_from_db()
        self.assertEqual(self.resource.available_quantity, 3)
        self.assertEqual(self.resource.reserved_quantity, 2)

        referral = InterfacilityReferral.objects.get(pk=referral_id)
        self.assertEqual(
            response.data['ambulance_request'],
            referral.ambulance_request_id,
        )
        ambulance_request = referral.ambulance_request
        self.assertEqual(ambulance_request.status, AmbulanceRequest.Status.REQUESTED)
        self.assertEqual(ambulance_request.patient_id, self.patient.pk)
        self.assertEqual(ambulance_request.destination_hospital_id, self.receiving_hospital.pk)
        self.assertEqual(ambulance_request.pickup_address, self.source_hospital.address)
        transaction_record = referral.reservation_transaction
        self.assertEqual(transaction_record.transaction_type, ResourceTransaction.TransactionType.RESERVE)
        self.assertEqual(transaction_record.quantity, -2)
        self.assertEqual(transaction_record.metadata, {'referral_id': referral_id})

        response = self.client.post(f'/api/ambulance/referrals/{referral_id}/accept/')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(AmbulanceRequest.objects.count(), 1)
        self.assertEqual(ResourceTransaction.objects.count(), 1)
        self.resource.refresh_from_db()
        self.assertEqual(self.resource.available_quantity, 3)
        self.assertEqual(self.resource.reserved_quantity, 2)

    def test_insufficient_resource_leaves_referral_unaccepted(self):
        referral_id = self._create_referral()
        self.resource.available_quantity = 1
        self.resource.save(update_fields=['available_quantity'])
        self.client.force_authenticate(self.receiver_staff)

        response = self.client.post(f'/api/ambulance/referrals/{referral_id}/accept/')

        self.assertEqual(response.status_code, 400)
        referral = InterfacilityReferral.objects.get(pk=referral_id)
        self.assertEqual(referral.status, InterfacilityReferral.Status.PENDING)
        self.assertIsNone(referral.ambulance_request_id)
        self.resource.refresh_from_db()
        self.assertEqual(self.resource.available_quantity, 1)
        self.assertEqual(self.resource.reserved_quantity, 0)
        self.assertEqual(ResourceTransaction.objects.count(), 0)
        self.assertEqual(AmbulanceRequest.objects.count(), 0)
