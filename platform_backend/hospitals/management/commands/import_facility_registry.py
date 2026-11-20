import csv

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from hospitals.models import Hospital


REQUIRED_COLUMNS = {
    'master_facility_code',
    'name',
    'registration_number',
    'facility_level',
    'ownership_type',
    'county',
    'sub_county',
    'county_rank',
    'sub_county_rank',
    'country',
    'address',
    'city',
    'phone',
    'email',
}


class Command(BaseCommand):
    help = 'Validate and import facility registry records from a CSV file.'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', help='Path to the authoritative registry CSV.')
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Validate all rows without writing any records.',
        )

    def handle(self, *args, **options):
        csv_file = options['csv_file']
        dry_run = options['dry_run']
        try:
            with open(csv_file, encoding='utf-8-sig', newline='') as source:
                reader = csv.DictReader(source)
                missing_columns = REQUIRED_COLUMNS - set(reader.fieldnames or ())
                if missing_columns:
                    raise CommandError(
                        'CSV is missing required columns: '
                        + ', '.join(sorted(missing_columns))
                    )
                plans = self._validate_rows(reader)
        except OSError as exc:
            raise CommandError(f'Could not read CSV file: {exc}') from exc

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f'Dry run successful: {len(plans)} facility row(s) validated; no changes made.'
                )
            )
            return

        with transaction.atomic():
            for hospital, is_new in plans:
                hospital.save()
        self.stdout.write(
            self.style.SUCCESS(
                f'Imported {len(plans)} facility row(s) '
                f'({sum(is_new for _, is_new in plans)} created, '
                f'{sum(not is_new for _, is_new in plans)} updated).'
            )
        )

    def _validate_rows(self, reader):
        plans = []
        seen_codes = set()
        seen_registration_numbers = set()
        errors = []

        for line_number, row in enumerate(reader, start=2):
            if None in row:
                errors.append(f'Line {line_number}: row contains more values than the CSV header.')
                continue
            values = {key: (value or '').strip() for key, value in row.items()}
            code = values.get('master_facility_code', '')
            registration_number = values.get('registration_number', '')
            if not code:
                errors.append(f'Line {line_number}: master_facility_code is required.')
                continue
            if not registration_number:
                errors.append(f'Line {line_number}: registration_number is required.')
                continue
            if code in seen_codes:
                errors.append(f'Line {line_number}: duplicate master_facility_code {code!r}.')
                continue
            if registration_number in seen_registration_numbers:
                errors.append(
                    f'Line {line_number}: duplicate registration_number {registration_number!r}.'
                )
                continue
            seen_codes.add(code)
            seen_registration_numbers.add(registration_number)

            try:
                level = int(values['facility_level'])
                county_rank = self._optional_positive_integer(values['county_rank'])
                sub_county_rank = self._optional_positive_integer(values['sub_county_rank'])
            except (TypeError, ValueError):
                errors.append(
                    f'Line {line_number}: facility_level must be 1-6 and ranks must be positive integers or blank.'
                )
                continue

            for required in ('name', 'ownership_type', 'county', 'sub_county',
                             'country', 'address', 'city', 'phone', 'email'):
                if not values.get(required):
                    errors.append(f'Line {line_number}: {required} is required.')

            if errors and errors[-1].startswith(f'Line {line_number}:'):
                continue

            hospital = Hospital.objects.filter(master_facility_code=code).first()
            is_new = hospital is None
            if is_new:
                hospital = Hospital(master_facility_code=code)
            hospital.name = values['name']
            hospital.registration_number = registration_number
            hospital.facility_level = level
            hospital.ownership_type = values['ownership_type']
            hospital.county = values['county']
            hospital.sub_county = values['sub_county']
            hospital.county_rank = county_rank
            hospital.sub_county_rank = sub_county_rank
            hospital.country = values['country']
            hospital.address = values['address']
            hospital.city = values['city']
            hospital.phone = values['phone']
            hospital.email = values['email']

            try:
                hospital.full_clean()
            except ValidationError as exc:
                errors.append(f'Line {line_number}: {exc}')
                continue
            plans.append((hospital, is_new))

        if errors:
            raise CommandError('CSV validation failed:\n' + '\n'.join(errors))
        return plans

    @staticmethod
    def _optional_positive_integer(value):
        if not value:
            return None
        integer = int(value)
        if integer < 1:
            raise ValueError('Ranks must be positive.')
        return integer
