"""Django admin registrations for the fleet app."""

from django.contrib import admin

from .models import MaintenanceRecord, Mechanic, Office, Vehicle


@admin.register(Office)
class OfficeAdmin(admin.ModelAdmin):
    list_display = ("name", "city")
    search_fields = ("name", "city")


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = (
        "vin",
        "license_plate",
        "make",
        "model",
        "year",
        "office",
        "is_active",
    )
    list_filter = ("is_active", "make", "office")
    search_fields = ("vin", "license_plate", "make", "model")
    autocomplete_fields = ("office",)


@admin.register(Mechanic)
class MechanicAdmin(admin.ModelAdmin):
    list_display = ("name", "certification_number", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "certification_number")


@admin.register(MaintenanceRecord)
class MaintenanceRecordAdmin(admin.ModelAdmin):
    list_display = (
        "vehicle",
        "mechanic",
        "maintenance_date",
        "maintenance_type",
        "cost",
    )
    list_filter = ("maintenance_type", "maintenance_date")
    search_fields = (
        "vehicle__vin",
        "vehicle__license_plate",
        "mechanic__name",
        "mechanic__certification_number",
    )
    autocomplete_fields = ("vehicle", "mechanic")
    date_hierarchy = "maintenance_date"
