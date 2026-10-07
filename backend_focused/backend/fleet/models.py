"""Domain models for the Fleet Tracker API."""

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models


class Office(models.Model):
    """A physical location that owns a subset of the fleet."""

    name = models.CharField(max_length=255)
    city = models.CharField(max_length=255)

    class Meta:
        ordering = ["name", "city"]
        constraints = [
            models.UniqueConstraint(
                fields=["name", "city"],
                name="unique_office_name_city",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.city})"


class Vehicle(models.Model):
    """A vehicle belonging to an office."""

    vin = models.CharField("VIN", max_length=17, unique=True)
    license_plate = models.CharField(max_length=20)
    make = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    year = models.PositiveIntegerField(validators=[MinValueValidator(1900)])
    office = models.ForeignKey(
        Office,
        on_delete=models.PROTECT,
        related_name="vehicles",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["license_plate"]
        constraints = [
            # License plates may be reused over time, but two *active* vehicles
            # must never share the same plate.
            models.UniqueConstraint(
                fields=["license_plate"],
                condition=models.Q(is_active=True),
                name="unique_active_license_plate",
            ),
        ]
        indexes = [
            models.Index(fields=["is_active"]),
            models.Index(fields=["make", "model"]),
        ]

    def __str__(self) -> str:
        return f"{self.year} {self.make} {self.model} ({self.license_plate})"


class Mechanic(models.Model):
    """A mechanic who performs maintenance on vehicles."""

    name = models.CharField(max_length=255)
    certification_number = models.CharField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.certification_number})"


class MaintenanceRecord(models.Model):
    """A single maintenance service performed on a vehicle."""

    vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.CASCADE,
        related_name="maintenance_records",
    )
    mechanic = models.ForeignKey(
        Mechanic,
        on_delete=models.PROTECT,
        related_name="maintenance_records",
    )
    maintenance_date = models.DateField()
    maintenance_type = models.CharField(max_length=100)
    cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-maintenance_date", "-id"]
        indexes = [
            models.Index(fields=["maintenance_date"]),
            models.Index(fields=["vehicle", "maintenance_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.vehicle} - {self.maintenance_date}"
