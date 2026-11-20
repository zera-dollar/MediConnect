from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError(_('The Email field must be set'))
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', User.Role.ADMIN)
        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Superuser must have is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Superuser must have is_superuser=True.'))
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', _('Platform Admin')
        HOSPITAL_ADMIN = 'HOSPITAL_ADMIN', _('Hospital Administrator')
        DOCTOR = 'DOCTOR', _('Doctor')
        NURSE = 'NURSE', _('Nurse')
        SPECIALIST = 'SPECIALIST', _('Specialist / Other Health Professional')
        STAFF = 'STAFF', _('Hospital Staff')
        PATIENT = 'PATIENT', _('Patient')

    class VerificationStatus(models.TextChoices):
        NOT_SUBMITTED = 'NOT_SUBMITTED', _('Not submitted')
        PENDING = 'PENDING', _('Pending verification')
        PENDING_EXTERNAL_ACCESS = 'PENDING_EXTERNAL_ACCESS', _('Pending external access')
        VERIFIED = 'VERIFIED', _('Verified')
        REJECTED = 'REJECTED', _('Rejected')

    username = None  # Use email as the unique identifier
    email = models.EmailField(_('email address'), unique=True)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.STAFF,
    )
    phone = models.CharField(max_length=20, blank=True)
    license_number = models.CharField(
        max_length=100,
        blank=True,
        help_text=_('Medical license / registration number')
    )
    specialization = models.CharField(max_length=150, blank=True)
    years_of_experience = models.PositiveIntegerField(default=0)
    bio = models.TextField(blank=True)
    profile_picture = models.ImageField(upload_to='profiles/', blank=True, null=True)
    is_verified = models.BooleanField(
        default=False,
        help_text=_('Whether the professional credentials have been verified')
    )
    verification_status = models.CharField(
        max_length=32,
        choices=VerificationStatus.choices,
        default=VerificationStatus.NOT_SUBMITTED,
        help_text=_('Current professional credential verification state')
    )
    preferred_locations = models.JSONField(
        default=list,
        blank=True,
        help_text=_('List of preferred city / region strings')
    )
    availability_status = models.CharField(
        max_length=20,
        choices=[
            ('AVAILABLE', 'Available'),
            ('BUSY', 'Busy'),
            ('ON_LEAVE', 'On Leave'),
            ('NOT_AVAILABLE', 'Not Available'),
        ],
        default='AVAILABLE',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = _('user')
        verbose_name_plural = _('users')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_full_name() or self.email} ({self.role})"

    @property
    def is_healthcare_professional(self):
        return self.role in {
            self.Role.DOCTOR,
            self.Role.NURSE,
            self.Role.SPECIALIST,
        }

    @property
    def is_hospital_admin(self):
        return self.role == self.Role.HOSPITAL_ADMIN


class ProfessionalDocument(models.Model):
    """Documents uploaded for verification (license, certificates, etc.)."""
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='documents'
    )
    document_type = models.CharField(
        max_length=50,
        choices=[
            ('LICENSE', 'Medical License'),
            ('CERTIFICATE', 'Certificate'),
            ('ID', 'Government ID'),
            ('CV', 'Curriculum Vitae'),
            ('OTHER', 'Other'),
        ]
    )
    file = models.FileField(upload_to='documents/')
    description = models.CharField(max_length=255, blank=True)
    verification_status = models.CharField(
        max_length=32,
        choices=User.VerificationStatus.choices,
        default=User.VerificationStatus.PENDING,
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_verified = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.email} - {self.document_type}"
