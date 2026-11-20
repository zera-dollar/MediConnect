from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from ambulances.models import AmbulanceRequest, InterfacilityReferral
from appointments.models import Appointment
from hospitals.models import Hospital

from .models import (
    HospitalResource,
    HospitalResourceSnapshot,
    ResourceCategory,
)
from .tasks import snapshot_hospital_resources


class OrganResourceCatalogTests(TestCase):
    def test_organs_category_and_types_are_available_after_migration(self):
        category = ResourceCategory.objects.get(slug='organs')

        self.assertEqual(category.name, 'Organs')
        self.assertEqual(
            set(category.types.values_list('name', flat=True)),
            {'Kidney', 'Liver', 'Heart', 'Lung'},
        )


class _ResourceRows(list):
    def only(self, *fields):
        return self

    def select_related(self, *fields):
        return self

    def order_by(self, *fields):
        return self

    def iterator(self):
        return iter(self)


class _SnapshotRows(list):
    def order_by(self, *fields):
        return sorted(self, key=lambda row: (
            row.hospital_resource_id_at_capture,
            row.recorded_at,
        ))


class ResourceTimeSeriesTests(TestCase):
    def setUp(self):
        self.resource = SimpleNamespace(
            pk=42,
            hospital_id=8,
            hospital=SimpleNamespace(name='Snapshot Hospital'),
            resource_type_id=13,
            resource_type=SimpleNamespace(name='Snapshot bed'),
            available_quantity=10,
            total_capacity=30,
            reserved_quantity=2,
        )
        self.user = get_user_model()(pk=1, email='resource-reader@example.com')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def get_burn_rate(self, snapshots, query=None):
        with (
            patch(
                'resources.views.HospitalResource.objects.filter',
                return_value=_ResourceRows([self.resource]),
            ),
            patch(
                'resources.views.HospitalResourceSnapshot.objects.filter',
                return_value=_SnapshotRows(snapshots),
            ),
        ):
            return self.client.get(reverse('resource-burn-rates'), query or {})

    def test_burn_rate_is_null_until_two_snapshots_span_an_hour(self):
        now = timezone.now()
        response = self.get_burn_rate([])
        result = response.data['results'][0]
        self.assertFalse(result['sufficient_history'])
        self.assertIsNone(result['burn_rate_per_hour'])
        self.assertIsNone(result['projected_hours_remaining'])

        snapshots = [
            SimpleNamespace(
                hospital_resource_id_at_capture=self.resource.pk,
                recorded_at=now - timedelta(minutes=30),
                available_quantity=10,
                total_capacity=30,
                reserved_quantity=2,
            ),
            SimpleNamespace(
                hospital_resource_id_at_capture=self.resource.pk,
                recorded_at=now - timedelta(minutes=5),
                available_quantity=8,
                total_capacity=30,
                reserved_quantity=2,
            ),
        ]
        result = self.get_burn_rate(snapshots).data['results'][0]
        self.assertFalse(result['sufficient_history'])
        self.assertEqual(result['sample_count'], 2)
        self.assertIsNone(result['burn_rate_per_hour'])

    def test_burn_rate_uses_the_change_between_sufficient_snapshots(self):
        now = timezone.now()
        snapshots = [
            SimpleNamespace(
                hospital_resource_id_at_capture=self.resource.pk,
                recorded_at=now - timedelta(hours=3),
                available_quantity=10,
                total_capacity=30,
                reserved_quantity=2,
            ),
            SimpleNamespace(
                hospital_resource_id_at_capture=self.resource.pk,
                recorded_at=now - timedelta(hours=1),
                available_quantity=6,
                total_capacity=30,
                reserved_quantity=2,
            ),
        ]

        response = self.get_burn_rate(snapshots, {'hours': 24})
        result = response.data['results'][0]

        self.assertTrue(result['sufficient_history'])
        self.assertEqual(result['sample_count'], 2)
        self.assertEqual(result['burn_rate_per_hour'], 2)
        self.assertEqual(result['projected_hours_remaining'], 3)
        self.assertEqual(result['latest_snapshot']['available_quantity'], 6)

    def test_hourly_task_upserts_a_single_snapshot_per_resource_hour(self):
        recorded_at = timezone.now().replace(minute=0, second=0, microsecond=0)
        stored = {}

        def upsert(**kwargs):
            key = (
                kwargs['hospital_resource_id_at_capture'],
                kwargs['recorded_at'],
            )
            stored[key] = kwargs['defaults']

        with (
            patch('resources.tasks.timezone.now', return_value=recorded_at),
            patch(
                'resources.tasks.HospitalResource.objects.filter',
                return_value=_ResourceRows([self.resource]),
            ),
            patch(
                'resources.tasks.HospitalResourceSnapshot.objects.update_or_create',
                side_effect=upsert,
            ),
        ):
            self.assertEqual(snapshot_hospital_resources.run(), 1)
            self.resource.available_quantity = 7
            self.assertEqual(snapshot_hospital_resources.run(), 1)

        self.assertEqual(len(stored), 1)
        snapshot = stored[(self.resource.pk, recorded_at)]
        self.assertEqual(snapshot['available_quantity'], 7)
        self.assertEqual(snapshot['total_capacity'], 30)
        self.assertEqual(snapshot['reserved_quantity'], 2)

    def test_timescale_command_rejects_non_postgresql_databases(self):
        if connection.vendor == 'postgresql':
            self.skipTest('This test covers the non-PostgreSQL safety guard.')

        with self.assertRaisesMessage(CommandError, 'require PostgreSQL'):
            call_command('setup_resource_snapshot_hypertable')


@override_settings(DEBUG=True)
class MvpDemoSeedCommandTests(TestCase):
    def setUp(self):
        self.source_hospital = Hospital.objects.create(
            name='Demo Source Facility',
            registration_number='DEMO-KE-002',
            address='Synthetic source address',
            city='Nairobi',
            phone='+254700000201',
            email='source@demo.health.test',
            latitude='-1.286389',
            longitude='36.817223',
        )
        self.receiving_hospital = Hospital.objects.create(
            name='Demo Receiving Facility',
            registration_number='MOH-NBI-001',
            address='Synthetic receiving address',
            city='Nairobi',
            phone='+254700000202',
            email='receiving@demo.health.test',
            latitude='-1.292066',
            longitude='36.821946',
        )

    def test_seed_command_is_repeatable_and_creates_workflow_records(self):
        call_command('seed_mvp_demo_data', password='synthetic-demo-password')
        call_command('seed_mvp_demo_data', password='synthetic-demo-password')

        patient = get_user_model().objects.get(email='mvp.patient@demo.health.test')
        self.assertTrue(patient.check_password('synthetic-demo-password'))
        self.assertEqual(
            get_user_model().objects.filter(email__startswith='mvp.').count(),
            5,
        )
        self.assertEqual(Appointment.objects.filter(patient=patient).count(), 1)
        self.assertEqual(InterfacilityReferral.objects.filter(patient=patient).count(), 1)
        self.assertEqual(AmbulanceRequest.objects.filter(patient=patient).count(), 1)

        resources = HospitalResource.objects.filter(
            hospital__in=(self.source_hospital, self.receiving_hospital),
        )
        self.assertEqual(
            HospitalResourceSnapshot.objects.filter(
                hospital_resource__in=resources,
            ).count(),
            resources.count() * 2,
        )
