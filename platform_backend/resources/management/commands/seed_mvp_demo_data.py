import secrets
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from ambulances.models import AmbulanceRequest, InterfacilityReferral
from appointments.models import Appointment
from hospitals.models import Department, Hospital, HospitalStaff
from notifications.models import Notification, NotificationPreference
from resources.models import (
    HospitalResource,
    HospitalResourceSnapshot,
    ResourceCategory,
    ResourceTransaction,
    ResourceType,
)


class Command(BaseCommand):
    help = 'Add synthetic records for the MediConnect MVP workflows (development only).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            help='Password for newly created demo accounts; generated securely if omitted.',
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError('Refusing to create demo records when DEBUG is disabled.')

        password = options['password'] or secrets.token_urlsafe(24)
        created_accounts = []
        with transaction.atomic():
            try:
                receiving_hospital = Hospital.objects.get(
                    registration_number='MOH-NBI-001',
                )
                source_hospital = Hospital.objects.get(
                    registration_number='DEMO-KE-002',
                )
            except Hospital.DoesNotExist as exc:
                raise CommandError(
                    'Run the existing synthetic facility seed first; expected '
                    'MOH-NBI-001 and DEMO-KE-002.'
                ) from exc

            if any(
                coordinate is None
                for hospital in (source_hospital, receiving_hospital)
                for coordinate in (hospital.latitude, hospital.longitude)
            ):
                raise CommandError(
                    'Source and receiving demo facilities need coordinates before seeding.'
                )

            demo_hospitals = list(
                Hospital.objects.filter(registration_number='MOH-NBI-001')
                | Hospital.objects.filter(registration_number__startswith='DEMO-KE-')
            )
            self._populate_facility_registry(demo_hospitals, receiving_hospital)

            patient, created = self._demo_user(
                email='mvp.patient@demo.health.test',
                role=User.Role.PATIENT,
                first_name='MVP Demo',
                last_name='Patient',
                phone='+254700000101',
                password=password,
            )
            if created:
                created_accounts.append(patient.email)
            nurse, created = self._demo_user(
                email='mvp.nurse@demo.health.test',
                role=User.Role.NURSE,
                first_name='MVP Demo',
                last_name='Nurse',
                phone='+254700000102',
                password=password,
            )
            if created:
                created_accounts.append(nurse.email)
            doctor, created = self._demo_user(
                email='mvp.doctor@demo.health.test',
                role=User.Role.DOCTOR,
                first_name='MVP Demo',
                last_name='Doctor',
                phone='+254700000103',
                password=password,
            )
            if created:
                created_accounts.append(doctor.email)
            manager, created = self._demo_user(
                email='mvp.manager@demo.health.test',
                role=User.Role.HOSPITAL_ADMIN,
                first_name='MVP Demo',
                last_name='Facility Manager',
                phone='+254700000104',
                password=password,
            )
            if created:
                created_accounts.append(manager.email)
            staff, created = self._demo_user(
                email='mvp.staff@demo.health.test',
                role=User.Role.STAFF,
                first_name='MVP Demo',
                last_name='Facility Staff',
                phone='+254700000105',
                password=password,
            )
            if created:
                created_accounts.append(staff.email)

            source_icu, _ = Department.objects.get_or_create(
                hospital=source_hospital,
                name='Intensive Care Unit',
                defaults={'description': 'Synthetic development department.'},
            )
            receiving_icu, _ = Department.objects.get_or_create(
                hospital=receiving_hospital,
                name='Intensive Care Unit',
                defaults={'description': 'Synthetic development department.'},
            )
            self._add_membership(nurse, source_hospital, source_icu, 'STAFF')
            self._add_membership(staff, source_hospital, source_icu, 'STAFF')
            self._add_membership(doctor, receiving_hospital, receiving_icu, 'STAFF')
            self._add_membership(manager, receiving_hospital, receiving_icu, 'MANAGER')

            category, _ = ResourceCategory.objects.get_or_create(
                slug='beds',
                defaults={
                    'name': 'Beds',
                    'is_critical': True,
                    'unit_label': 'beds',
                },
            )
            transfer_type, _ = ResourceType.objects.get_or_create(
                category=category,
                name='Synthetic Transfer Bed',
                defaults={
                    'code': 'MVP-DEMO-TRANSFER-BED',
                    'description': 'Synthetic stock for testing referral reservations.',
                },
            )
            transfer_resource, resource_created = HospitalResource.objects.get_or_create(
                hospital=receiving_hospital,
                resource_type=transfer_type,
                department=receiving_icu,
                defaults={
                    'total_capacity': 12,
                    'available_quantity': 8,
                    'reserved_quantity': 0,
                    'low_stock_threshold': 2,
                    'unit': 'beds',
                    'updated_by': manager,
                    'notes': 'Synthetic MVP demo inventory; not live hospital availability.',
                },
            )
            if resource_created:
                ResourceTransaction.objects.create(
                    hospital_resource=transfer_resource,
                    transaction_type=ResourceTransaction.TransactionType.ADD,
                    quantity=transfer_resource.available_quantity,
                    previous_available=0,
                    new_available=transfer_resource.available_quantity,
                    performed_by=manager,
                    reason='Synthetic MVP demo inventory baseline.',
                    reference='MVP-DEMO-BASELINE',
                    metadata={'demo': True},
                )

            self._seed_snapshots(demo_hospitals, transfer_resource)

            appointment, _ = Appointment.objects.get_or_create(
                patient=patient,
                professional=doctor,
                hospital=receiving_hospital,
                patient_name='MVP Demo Patient',
                patient_email=patient.email,
                defaults={
                    'patient_phone': patient.phone,
                    'start_datetime': timezone.now() + timedelta(days=2),
                    'duration_minutes': 30,
                    'status': Appointment.Status.REQUESTED,
                },
            )

            referral, referral_created = InterfacilityReferral.objects.get_or_create(
                source_hospital=source_hospital,
                receiving_hospital=receiving_hospital,
                patient=patient,
                referred_by=nurse,
                presenting_concern='Synthetic MVP transfer scenario; no real patient data.',
                defaults={
                    'acuity': InterfacilityReferral.Acuity.URGENT,
                    'vitals': {
                        'heart_rate': 104,
                        'respiratory_rate': 22,
                        'oxygen_saturation_pct': 93,
                    },
                    'interventions': 'Synthetic example: oxygen started and monitoring initiated.',
                    'resource_type': transfer_type,
                    'resource_quantity': 1,
                },
            )
            if referral_created:
                Notification.objects.get_or_create(
                    recipient=manager,
                    notification_type=Notification.NotificationType.SYSTEM,
                    title='MVP demo referral awaiting review',
                    defaults={
                        'message': (
                            'A synthetic interfacility referral is ready to review. '
                            'Accepting it reserves the demo resource and creates transport.'
                        ),
                        'data': {'referral_id': referral.pk, 'demo': True},
                    },
                )

            ambulance_request, ambulance_created = AmbulanceRequest.objects.get_or_create(
                patient=patient,
                destination_hospital=receiving_hospital,
                pickup_address='Synthetic driver telemetry pickup location',
                defaults={
                    'pickup_latitude': source_hospital.latitude,
                    'pickup_longitude': source_hospital.longitude,
                    'status': AmbulanceRequest.Status.EN_ROUTE,
                    'ambulance_code': 'MVP-DEMO-AMB-001',
                    'dispatcher': manager,
                    'ambulance_latitude': source_hospital.latitude,
                    'ambulance_longitude': source_hospital.longitude,
                    'eta_minutes': 15,
                    'dispatched_at': timezone.now(),
                },
            )
            if ambulance_created:
                Notification.objects.get_or_create(
                    recipient=patient,
                    notification_type=Notification.NotificationType.AMBULANCE_UPDATE,
                    title='MVP demo transport is en route',
                    defaults={
                        'message': 'This is a synthetic transport request for testing only.',
                        'data': {'ambulance_request_id': ambulance_request.pk, 'demo': True},
                    },
                )

            for user in (patient, nurse, doctor, manager, staff):
                NotificationPreference.objects.get_or_create(user=user)
                Notification.objects.get_or_create(
                    recipient=user,
                    notification_type=Notification.NotificationType.SYSTEM,
                    title='MVP demo data ready',
                    defaults={
                        'message': 'Synthetic development records are available in MediConnect.',
                        'data': {'demo': True},
                    },
                )

        self.stdout.write(self.style.SUCCESS(
            'Synthetic MVP data populated: registry metadata, demo accounts, '
            'appointment, pending referral, transport request, and hourly resource history.'
        ))
        self.stdout.write(
            f'Referral #{referral.pk} remains pending; accept it in the receiving '
            f'hospital account to test reservation and linked transport.'
        )
        if created_accounts:
            self.stdout.write(self.style.WARNING(
                'Development-only login accounts created (change their passwords before sharing this environment):'
            ))
            for email in created_accounts:
                self.stdout.write(f'  {email}')
            self.stdout.write(f'  One-time password for new accounts: {password}')
        else:
            self.stdout.write('Existing demo account passwords were not changed.')

    @staticmethod
    def _demo_user(*, email, role, first_name, last_name, phone, password):
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'role': role,
                'first_name': first_name,
                'last_name': last_name,
                'phone': phone,
                'is_verified': False,
                'verification_status': User.VerificationStatus.NOT_SUBMITTED,
            },
        )
        if not created and user.role != role:
            raise CommandError(f'{email} already exists with a different role.')
        if created:
            user.set_password(password)
            user.save(update_fields=['password'])
        return user, created

    @staticmethod
    def _add_membership(user, hospital, department, role):
        membership, created = HospitalStaff.objects.get_or_create(
            user=user,
            hospital=hospital,
            defaults={
                'department': department,
                'role_at_hospital': role,
                'is_primary': False,
                'is_active': True,
            },
        )
        if not created and not membership.is_active:
            membership.is_active = True
            membership.save(update_fields=['is_active'])

    @staticmethod
    def _populate_facility_registry(hospitals, receiving_hospital):
        for index, hospital in enumerate(hospitals, start=1):
            update_fields = []
            if not hospital.master_facility_code:
                hospital.master_facility_code = f'DEMO-MFL-{hospital.pk:05d}'
                update_fields.append('master_facility_code')
            if hospital.facility_level is None:
                hospital.facility_level = 4 if hospital.pk == receiving_hospital.pk else 2 + index % 5
                update_fields.append('facility_level')
            if not hospital.ownership_type:
                hospital.ownership_type = 'Public (synthetic)'
                update_fields.append('ownership_type')
            if not hospital.county:
                hospital.county = f'{hospital.city} County (synthetic)'
                update_fields.append('county')
            if not hospital.sub_county:
                hospital.sub_county = f'{hospital.city} Central (synthetic)'
                update_fields.append('sub_county')
            if hospital.county_rank is None:
                hospital.county_rank = index
                update_fields.append('county_rank')
            if hospital.sub_county_rank is None:
                hospital.sub_county_rank = index
                update_fields.append('sub_county_rank')
            if update_fields:
                hospital.save(update_fields=update_fields)

    @staticmethod
    def _seed_snapshots(hospitals, transfer_resource):
        recorded_at = timezone.now().replace(minute=0, second=0, microsecond=0)
        resources = list(
            HospitalResource.objects.filter(hospital__in=hospitals)
            .exclude(pk=transfer_resource.pk)
            .order_by('pk')
        )
        resources.append(transfer_resource)
        for index, resource in enumerate(resources):
            earlier_available = min(
                resource.total_capacity,
                resource.available_quantity + (2 if index % 5 == 0 else 0),
            )
            for offset, available in ((-2, earlier_available), (-1, resource.available_quantity)):
                HospitalResourceSnapshot.objects.update_or_create(
                    hospital_resource_id_at_capture=resource.pk,
                    recorded_at=recorded_at + timedelta(hours=offset),
                    defaults={
                        'hospital_resource': resource,
                        'available_quantity': available,
                        'total_capacity': resource.total_capacity,
                        'reserved_quantity': resource.reserved_quantity,
                    },
                )
