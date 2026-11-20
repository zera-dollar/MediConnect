from unittest.mock import mock_open, patch

from django.core.management import call_command, CommandError
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from .models import Hospital, HospitalStaff

User = get_user_model()


VALID_REGISTRY_CSV = (
    'master_facility_code,name,registration_number,facility_level,ownership_type,'
    'county,sub_county,county_rank,sub_county_rank,country,address,city,phone,email\n'
    'REG-001,Registry Hospital,REGISTRATION-001,4,Public,County A,Subcounty A,1,1,'
    'Kenya,1 Registry Road,Nairobi,+254700000001,registry@example.test\n'
)


class FacilityRegistryTests(TestCase):
    def test_facility_registry_fields_validate_level_and_unique_master_code(self):
        hospital = Hospital(
            name='Registry Hospital',
            registration_number='REGISTRATION-001',
            master_facility_code='REG-001',
            facility_level=7,
            address='1 Registry Road',
            city='Nairobi',
            phone='+254700000001',
            email='registry@example.test',
        )

        with self.assertRaises(ValidationError):
            hospital.full_clean()

        hospital.facility_level = Hospital.FacilityLevel.LEVEL_4
        hospital.full_clean()
        hospital.save()
        duplicate = Hospital(
            name='Another Hospital',
            registration_number='REGISTRATION-002',
            master_facility_code='REG-001',
            facility_level=Hospital.FacilityLevel.LEVEL_4,
            address='2 Registry Road',
            city='Nairobi',
            phone='+254700000002',
            email='another@example.test',
        )
        with self.assertRaises(ValidationError):
            duplicate.full_clean()

    @patch('builtins.open', new_callable=mock_open, read_data=VALID_REGISTRY_CSV)
    def test_import_command_dry_run_validates_without_writing(self, mocked_open):
        call_command('import_facility_registry', 'registry.csv', dry_run=True)

        self.assertFalse(Hospital.objects.exists())
        mocked_open.assert_called_once()

    @patch('builtins.open', new_callable=mock_open, read_data=VALID_REGISTRY_CSV)
    def test_import_command_persists_supplied_registry_values(self, mocked_open):
        call_command('import_facility_registry', 'registry.csv')

        hospital = Hospital.objects.get(master_facility_code='REG-001')
        self.assertEqual(hospital.facility_level, Hospital.FacilityLevel.LEVEL_4)
        self.assertEqual(hospital.ownership_type, 'Public')
        self.assertEqual(hospital.county, 'County A')
        self.assertEqual(hospital.sub_county_rank, 1)

    @patch(
        'builtins.open',
        new_callable=mock_open,
        read_data=VALID_REGISTRY_CSV.replace(',4,', ',7,'),
    )
    def test_import_command_rejects_invalid_level_without_partial_import(self, mocked_open):
        with self.assertRaises(CommandError):
            call_command('import_facility_registry', 'registry.csv')

        self.assertFalse(Hospital.objects.exists())


class HospitalMembershipApiTests(TestCase):
    def test_mine_includes_membership_role_and_only_active_hospitals(self):
        user = User.objects.create_user(
            email='facility-manager@example.test',
            password='TestPass123!',
            role=User.Role.HOSPITAL_ADMIN,
        )
        hospital = Hospital.objects.create(
            name='Managed Hospital',
            registration_number='MANAGED-001',
            master_facility_code='MFL-001',
            facility_level=4,
            county='Nairobi',
            address='1 Managed Road',
            city='Nairobi',
            phone='+254700000001',
            email='managed@example.test',
        )
        inactive_hospital = Hospital.objects.create(
            name='Inactive Hospital',
            registration_number='MANAGED-002',
            address='2 Managed Road',
            city='Nairobi',
            phone='+254700000002',
            email='inactive@example.test',
            is_active=False,
        )
        HospitalStaff.objects.create(
            user=user,
            hospital=hospital,
            role_at_hospital='MANAGER',
        )
        HospitalStaff.objects.create(
            user=user,
            hospital=inactive_hospital,
            role_at_hospital='ADMIN',
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get('/api/hospitals/mine/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], hospital.pk)
        self.assertEqual(response.data[0]['role_at_hospital'], 'MANAGER')
        self.assertEqual(response.data[0]['master_facility_code'], 'MFL-001')
