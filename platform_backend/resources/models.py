from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator
from decimal import Decimal


class ResourceCategory(models.Model):
    """Top-level categories: Beds, Blood, Oxygen, Medications, Equipment, etc."""
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, blank=True, help_text=_('Icon name or emoji'))
    is_critical = models.BooleanField(
        default=False,
        help_text=_('Whether low stock should trigger alerts')
    )
    unit_label = models.CharField(
        max_length=30,
        default='units',
        help_text=_('e.g. beds, units, litres, vials')
    )

    class Meta:
        verbose_name_plural = 'Resource categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class ResourceType(models.Model):
    """Specific type within a category, e.g. ICU Bed, A+ Blood, Oxygen Cylinder 40L."""
    category = models.ForeignKey(
        ResourceCategory,
        on_delete=models.CASCADE,
        related_name='types'
    )
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)
    attributes = models.JSONField(
        default=dict,
        blank=True,
        help_text=_('Extra attributes e.g. {"blood_group": "A+", "size": "40L"}')
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('category', 'name')
        ordering = ['category', 'name']

    def __str__(self):
        return f"{self.name} ({self.category.name})"


class HospitalResource(models.Model):
    """Current stock / availability of a resource type at a specific hospital."""
    hospital = models.ForeignKey(
        'hospitals.Hospital',
        on_delete=models.CASCADE,
        related_name='resources'
    )
    resource_type = models.ForeignKey(
        ResourceType,
        on_delete=models.CASCADE,
        related_name='hospital_stocks'
    )
    department = models.ForeignKey(
        'hospitals.Department',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resources'
    )
    total_capacity = models.PositiveIntegerField(
        default=0,
        help_text=_('Maximum capacity (e.g. total beds of this type)')
    )
    available_quantity = models.PositiveIntegerField(
        default=0,
        help_text=_('Currently available / free')
    )
    reserved_quantity = models.PositiveIntegerField(
        default=0,
        help_text=_('Reserved / allocated but not yet used')
    )
    unit = models.CharField(max_length=30, blank=True)
    low_stock_threshold = models.PositiveIntegerField(
        default=5,
        help_text=_('Alert when available_quantity falls to or below this')
    )
    last_updated = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resource_updates'
    )
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('hospital', 'resource_type', 'department')
        indexes = [
            models.Index(fields=['hospital', 'available_quantity']),
            models.Index(fields=['resource_type', 'available_quantity']),
        ]
        verbose_name = _('hospital resource')
        verbose_name_plural = _('hospital resources')

    def __str__(self):
        return f"{self.resource_type.name} @ {self.hospital.name}: {self.available_quantity} available"

    @property
    def occupancy_rate(self):
        if self.total_capacity == 0:
            return None
        occupied = self.total_capacity - self.available_quantity
        return round((occupied / self.total_capacity) * 100, 1)

    @property
    def is_low_stock(self):
        return self.available_quantity <= self.low_stock_threshold

    @property
    def is_critical(self):
        return self.resource_type.category.is_critical and self.is_low_stock


class HospitalResourceSnapshot(models.Model):
    """Hourly history of a hospital resource's recorded quantities."""
    hospital_resource = models.ForeignKey(
        HospitalResource,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='snapshots',
    )
    hospital_resource_id_at_capture = models.BigIntegerField()
    recorded_at = models.DateTimeField()
    available_quantity = models.PositiveIntegerField()
    total_capacity = models.PositiveIntegerField()
    reserved_quantity = models.PositiveIntegerField()

    class Meta:
        ordering = ['recorded_at']
        constraints = [
            models.UniqueConstraint(
                fields=['hospital_resource_id_at_capture', 'recorded_at'],
                name='res_snap_resource_time_uniq',
            ),
            models.UniqueConstraint(
                fields=['id', 'recorded_at'],
                name='res_snap_id_time_uniq',
            ),
        ]
        indexes = [
            models.Index(
                fields=['recorded_at', 'hospital_resource_id_at_capture'],
                name='res_snap_time_resource_idx',
            ),
        ]


class ResourceTransaction(models.Model):
    """Audit log of every change to resource quantities."""
    class TransactionType(models.TextChoices):
        ADD = 'ADD', _('Stock added / received')
        REMOVE = 'REMOVE', _('Stock used / removed')
        RESERVE = 'RESERVE', _('Reserved')
        RELEASE = 'RELEASE', _('Reservation released')
        ADJUST = 'ADJUST', _('Manual adjustment / count correction')
        TRANSFER = 'TRANSFER', _('Transfer between departments')

    hospital_resource = models.ForeignKey(
        HospitalResource,
        on_delete=models.CASCADE,
        related_name='transactions'
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=TransactionType.choices
    )
    quantity = models.IntegerField(
        help_text=_('Positive for ADD/RELEASE, negative for REMOVE/RESERVE')
    )
    previous_available = models.PositiveIntegerField()
    new_available = models.PositiveIntegerField()
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='resource_transactions'
    )
    reason = models.CharField(max_length=255, blank=True)
    reference = models.CharField(
        max_length=100,
        blank=True,
        help_text=_('External reference e.g. patient ID, order number')
    )
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['hospital_resource', '-created_at']),
        ]

    def __str__(self):
        return f"{self.transaction_type} {self.quantity} on {self.hospital_resource}"


class BloodStock(models.Model):
    """Specialized model for blood units with expiry and group tracking."""
    class BloodGroup(models.TextChoices):
        A_POS = 'A+', 'A+'
        A_NEG = 'A-', 'A-'
        B_POS = 'B+', 'B+'
        B_NEG = 'B-', 'B-'
        AB_POS = 'AB+', 'AB+'
        AB_NEG = 'AB-', 'AB-'
        O_POS = 'O+', 'O+'
        O_NEG = 'O-', 'O-'

    class Component(models.TextChoices):
        WHOLE = 'WHOLE', _('Whole Blood')
        RBC = 'RBC', _('Red Blood Cells')
        PLASMA = 'PLASMA', _('Plasma')
        PLATELETS = 'PLATELETS', _('Platelets')
        CRYOPRECIPITATE = 'CRYO', _('Cryoprecipitate')

    hospital = models.ForeignKey(
        'hospitals.Hospital',
        on_delete=models.CASCADE,
        related_name='blood_stocks'
    )
    blood_group = models.CharField(max_length=3, choices=BloodGroup.choices)
    component = models.CharField(
        max_length=20,
        choices=Component.choices,
        default=Component.WHOLE
    )
    units_available = models.PositiveIntegerField(default=0)
    units_reserved = models.PositiveIntegerField(default=0)
    expiry_date = models.DateField(null=True, blank=True)
    batch_number = models.CharField(max_length=100, blank=True)
    low_stock_threshold = models.PositiveIntegerField(default=5)
    last_updated = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    class Meta:
        unique_together = ('hospital', 'blood_group', 'component', 'batch_number')
        ordering = ['blood_group', 'component']
        verbose_name_plural = 'Blood stocks'

    def __str__(self):
        return f"{self.blood_group} {self.component} @ {self.hospital.name}: {self.units_available}"

    @property
    def is_low_stock(self):
        return self.units_available <= self.low_stock_threshold


class OxygenSupply(models.Model):
    """Oxygen cylinders / liquid oxygen / concentrators tracking."""
    class SupplyType(models.TextChoices):
        CYLINDER = 'CYLINDER', _('Oxygen Cylinder')
        LIQUID = 'LIQUID', _('Liquid Oxygen')
        CONCENTRATOR = 'CONCENTRATOR', _('Oxygen Concentrator')
        PIPELINE = 'PIPELINE', _('Central Pipeline')

    hospital = models.ForeignKey(
        'hospitals.Hospital',
        on_delete=models.CASCADE,
        related_name='oxygen_supplies'
    )
    supply_type = models.CharField(max_length=20, choices=SupplyType.choices)
    capacity_litres = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=_('Total capacity in litres (for cylinders / tanks)')
    )
    current_level_litres = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    number_of_units = models.PositiveIntegerField(
        default=0,
        help_text=_('Number of cylinders / machines')
    )
    available_units = models.PositiveIntegerField(default=0)
    low_level_threshold_pct = models.PositiveIntegerField(
        default=20,
        help_text=_('Alert when current_level falls below this % of capacity')
    )
    location = models.CharField(max_length=150, blank=True)
    last_refilled = models.DateTimeField(null=True, blank=True)
    last_updated = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = 'Oxygen supplies'
        ordering = ['hospital', 'supply_type']

    def __str__(self):
        return f"{self.supply_type} @ {self.hospital.name}"

    @property
    def level_percentage(self):
        if not self.capacity_litres or self.capacity_litres == 0:
            return None
        return round((self.current_level_litres / self.capacity_litres) * 100, 1)

    @property
    def is_low(self):
        pct = self.level_percentage
        if pct is None:
            return self.available_units <= 2
        return pct <= self.low_level_threshold_pct
