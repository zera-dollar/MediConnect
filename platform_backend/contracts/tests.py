from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from hospitals.models import Hospital, HospitalStaff
from .models import Bid, ContractAssignment, WorkContract


class ContractAssignmentCheckInTests(APITestCase):
    def setUp(self):
        self.professional = get_user_model().objects.create_user(
            email='professional@example.test',
            password='SafePassword123!',
            role='DOCTOR',
        )
        hospital = Hospital.objects.create(
            name='Test Hospital',
            registration_number='TEST-HOSPITAL-1',
            address='1 Test Street',
            city='Nairobi',
            phone='+254700000000',
            email='hospital@example.test',
        )
        start = timezone.now() + timedelta(days=1)
        end = start + timedelta(hours=8)
        contract = WorkContract.objects.create(
            hospital=hospital,
            title='Test shift',
            description='Test assignment workflow',
            start_datetime=start,
            end_datetime=end,
        )
        self.assignment = ContractAssignment.objects.create(
            contract=contract,
            professional=self.professional,
            agreed_rate='100.00',
            start_datetime=start,
            end_datetime=end,
        )
        self.client.force_authenticate(self.professional)

    def test_check_in_and_check_out_actions_accept_post(self):
        response = self.client.post(f'/api/assignments/{self.assignment.id}/check_in/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'IN_PROGRESS')

        response = self.client.post(f'/api/assignments/{self.assignment.id}/check_out/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'COMPLETED')


class VerifiedProfessionalBidTests(APITestCase):
    def setUp(self):
        self.professional = get_user_model().objects.create_user(
            email='bidder@example.test',
            password='SafePassword123!',
            role='DOCTOR',
        )
        self.hospital = Hospital.objects.create(
            name='Bidding Hospital',
            registration_number='BID-HOSPITAL-1',
            address='1 Test Street',
            city='Nairobi',
            phone='+254700000000',
            email='bids@example.test',
        )
        start = timezone.now() + timedelta(days=1)
        self.contract = WorkContract.objects.create(
            hospital=self.hospital,
            title='Open shift',
            description='A shift available for bidding',
            start_datetime=start,
            end_datetime=start + timedelta(hours=8),
            status=WorkContract.Status.OPEN,
        )

    def test_unverified_professional_cannot_create_bid(self):
        self.client.force_authenticate(self.professional)

        response = self.client.post(
            '/api/bids/',
            {'contract': self.contract.pk, 'proposed_rate': '100.00'},
            format='json',
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Bid.objects.exists())

    def test_verified_professional_can_create_bid(self):
        self.professional.is_verified = True
        self.professional.save(update_fields=['is_verified'])
        self.client.force_authenticate(self.professional)

        response = self.client.post(
            '/api/bids/',
            {'contract': self.contract.pk, 'proposed_rate': '100.00'},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Bid.objects.get().bidder, self.professional)

    def test_unverified_bidder_cannot_be_accepted(self):
        bid = Bid.objects.create(
            contract=self.contract,
            bidder=self.professional,
            proposed_rate='100.00',
        )
        admin = get_user_model().objects.create_user(
            email='hospital-admin@example.test',
            password='SafePassword123!',
            role='HOSPITAL_ADMIN',
        )
        HospitalStaff.objects.create(
            user=admin,
            hospital=self.hospital,
            role_at_hospital='ADMIN',
            is_active=True,
        )
        self.client.force_authenticate(admin)

        response = self.client.post(
            f'/api/bids/{bid.pk}/review/',
            {'status': 'ACCEPTED'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        bid.refresh_from_db()
        self.assertEqual(bid.status, Bid.Status.PENDING)
