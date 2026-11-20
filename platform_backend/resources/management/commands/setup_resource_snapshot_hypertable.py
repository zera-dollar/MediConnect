from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

from resources.models import HospitalResourceSnapshot


class Command(BaseCommand):
    help = 'Convert resource snapshots to a TimescaleDB hypertable.'

    def handle(self, *args, **options):
        if connection.vendor != 'postgresql':
            raise CommandError(
                'Resource snapshot hypertables require PostgreSQL with TimescaleDB.'
            )

        table_name = HospitalResourceSnapshot._meta.db_table
        quoted_table = connection.ops.quote_name(table_name)
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT EXISTS (SELECT 1 FROM pg_extension "
                    "WHERE extname = 'timescaledb')"
                )
                if not cursor.fetchone()[0]:
                    raise CommandError(
                        'The TimescaleDB extension is not installed in this database.'
                    )

                cursor.execute(
                    'SELECT namespace_row.nspname '
                    'FROM pg_class AS relation_row '
                    'JOIN pg_namespace AS namespace_row '
                    'ON namespace_row.oid = relation_row.relnamespace '
                    'WHERE relation_row.oid = to_regclass(%s)',
                    [table_name],
                )
                relation = cursor.fetchone()
                if relation is None:
                    raise CommandError(
                        'The resource snapshot table does not exist. Apply the '
                        'resources schema migration before running this command.'
                    )
                table_schema = relation[0]

                cursor.execute(
                    'SELECT EXISTS ('
                    'SELECT 1 FROM timescaledb_information.hypertables '
                    'WHERE hypertable_schema = %s '
                    'AND hypertable_name = %s)',
                    [table_schema, table_name],
                )
                if cursor.fetchone()[0]:
                    self.stdout.write('Resource snapshot table is already a hypertable.')
                    return

                cursor.execute(
                    'SELECT EXISTS ('
                    'SELECT 1 FROM pg_constraint '
                    'WHERE confrelid = to_regclass(%s) AND contype = %s)',
                    [table_name, 'f'],
                )
                if cursor.fetchone()[0]:
                    raise CommandError(
                        'Cannot safely convert the snapshot table because another '
                        'table has a foreign key referencing it.'
                    )

                cursor.execute(
                    'SELECT constraint_row.conname, constraint_row.contype, '
                    'array_agg(column_row.attname ORDER BY key_row.ordinality) '
                    'FROM pg_constraint AS constraint_row '
                    'JOIN LATERAL unnest(constraint_row.conkey) '
                    'WITH ORDINALITY AS key_row(attnum, ordinality) ON TRUE '
                    'JOIN pg_attribute AS column_row '
                    'ON column_row.attrelid = constraint_row.conrelid '
                    'AND column_row.attnum = key_row.attnum '
                    'WHERE constraint_row.conrelid = to_regclass(%s) '
                    'AND constraint_row.contype IN (%s, %s) '
                    'GROUP BY constraint_row.oid, constraint_row.conname, '
                    'constraint_row.contype',
                    [table_name, 'p', 'u'],
                )
                constraints = cursor.fetchall()
                primary_keys = [
                    (name, columns)
                    for name, kind, columns in constraints
                    if kind == 'p'
                ]
                if len(primary_keys) > 1 or (
                    primary_keys and primary_keys[0][1] != ['id']
                ):
                    raise CommandError(
                        'Expected the default Django id primary key on the snapshot table.'
                    )

                for name, kind, columns in constraints:
                    if kind == 'u' and 'recorded_at' not in columns:
                        raise CommandError(
                            f'Cannot convert safely: unique constraint {name} '
                            'does not include recorded_at.'
                        )

                if primary_keys:
                    cursor.execute(
                        f'ALTER TABLE {quoted_table} DROP CONSTRAINT '
                        f'{connection.ops.quote_name(primary_keys[0][0])}'
                    )

                has_id_time_constraint = any(
                    kind == 'u' and set(columns) == {'id', 'recorded_at'}
                    for _, kind, columns in constraints
                )
                if not has_id_time_constraint:
                    cursor.execute(
                        f'ALTER TABLE {quoted_table} ADD CONSTRAINT '
                        f'{connection.ops.quote_name("res_snap_id_time_uniq")} '
                        f'UNIQUE ({connection.ops.quote_name("id")}, '
                        f'{connection.ops.quote_name("recorded_at")})'
                    )

                cursor.execute(
                    'SELECT create_hypertable(%s::regclass, %s::name, '
                    'if_not_exists => TRUE, migrate_data => TRUE)',
                    [table_name, 'recorded_at'],
                )

        self.stdout.write(
            self.style.SUCCESS(
                'Resource snapshots are now a TimescaleDB hypertable. '
                'The Django id sequence remains in use; the database uses '
                'a composite id/recorded_at unique constraint for hypertable compatibility.'
            )
        )
