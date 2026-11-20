from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, ProfessionalDocument


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        'email', 'first_name', 'last_name', 'role', 'is_verified',
        'verification_status', 'is_active', 'created_at',
    )
    list_filter = ('role', 'is_verified', 'verification_status', 'is_active', 'availability_status')
    search_fields = ('email', 'first_name', 'last_name', 'license_number')
    ordering = ('-created_at',)
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal', {'fields': ('first_name', 'last_name', 'phone', 'profile_picture', 'bio')}),
        ('Professional', {'fields': ('role', 'license_number', 'specialization', 'years_of_experience', 'is_verified', 'verification_status', 'preferred_locations', 'availability_status')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('last_login', 'date_joined', 'created_at', 'updated_at')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'role', 'first_name', 'last_name'),
        }),
    )
    readonly_fields = ('created_at', 'updated_at', 'date_joined', 'last_login')

    def save_model(self, request, obj, form, change):
        if obj.verification_status == User.VerificationStatus.VERIFIED:
            obj.is_verified = True
        elif obj.is_verified:
            obj.verification_status = User.VerificationStatus.VERIFIED
        super().save_model(request, obj, form, change)


@admin.register(ProfessionalDocument)
class ProfessionalDocumentAdmin(admin.ModelAdmin):
    list_display = ('user', 'document_type', 'is_verified', 'uploaded_at')
    list_filter = ('document_type', 'is_verified')
    search_fields = ('user__email',)
