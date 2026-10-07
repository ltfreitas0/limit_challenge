"""Serializers for the Fleet Tracker API."""

from rest_framework import serializers

from .models import MaintenanceRecord, Mechanic, Office, Vehicle


class OfficeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Office
        fields = ["id", "name", "city"]


class OfficeSummarySerializer(serializers.ModelSerializer):
    """Read-only representation of an office with aggregate statistics."""

    active_vehicle_count = serializers.IntegerField(read_only=True)
    maintenance_cost_last_year = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    last_maintenance = serializers.DateField(read_only=True, allow_null=True)

    class Meta:
        model = Office
        fields = [
            "id",
            "name",
            "city",
            "active_vehicle_count",
            "maintenance_cost_last_year",
            "last_maintenance",
        ]


class MechanicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mechanic
        fields = ["id", "name", "certification_number", "is_active"]


class MechanicSummarySerializer(serializers.ModelSerializer):
    """Compact mechanic representation embedded in maintenance records."""

    class Meta:
        model = Mechanic
        fields = ["id", "name", "certification_number", "is_active"]


class MaintenanceRecordDetailSerializer(serializers.ModelSerializer):
    """Maintenance record with embedded mechanic information."""

    mechanic = MechanicSummarySerializer(read_only=True)

    class Meta:
        model = MaintenanceRecord
        fields = [
            "id",
            "mechanic",
            "maintenance_date",
            "maintenance_type",
            "cost",
            "notes",
        ]


class MechanicWorkloadSerializer(serializers.ModelSerializer):
    maintenance_count = serializers.IntegerField(read_only=True)
    total_cost = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = Mechanic
        fields = [
            "id",
            "name",
            "certification_number",
            "maintenance_count",
            "total_cost",
        ]


class VehicleSerializer(serializers.ModelSerializer):
    office_name = serializers.CharField(source="office.name", read_only=True)

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "vin",
            "license_plate",
            "make",
            "model",
            "year",
            "office",
            "office_name",
            "is_active",
        ]

    def validate(self, attrs):
        instance = self.instance
        vin = attrs.get("vin", instance.vin if instance else None)
        license_plate = attrs.get(
            "license_plate", instance.license_plate if instance else None
        )
        is_active = attrs.get("is_active", instance.is_active if instance else True)

        if vin:
            duplicates = Vehicle.objects.filter(vin__iexact=vin)
            if instance:
                duplicates = duplicates.exclude(pk=instance.pk)
            if duplicates.exists():
                raise serializers.ValidationError(
                    {"vin": "A vehicle with this VIN already exists."}
                )

        if license_plate and is_active:
            duplicates = Vehicle.objects.filter(
                license_plate__iexact=license_plate, is_active=True
            )
            if instance:
                duplicates = duplicates.exclude(pk=instance.pk)
            if duplicates.exists():
                raise serializers.ValidationError(
                    {
                        "license_plate": "Another active vehicle already uses "
                        "this license plate."
                    }
                )

        return attrs


class VehicleDetailSerializer(serializers.ModelSerializer):
    """Vehicle with its office and complete, newest-first maintenance history."""

    office = OfficeSerializer(read_only=True)
    maintenance_history = MaintenanceRecordDetailSerializer(
        source="maintenance_records", many=True, read_only=True
    )

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "vin",
            "license_plate",
            "make",
            "model",
            "year",
            "is_active",
            "office",
            "maintenance_history",
        ]


class VehicleMaintenanceAlertSerializer(serializers.ModelSerializer):
    """Active vehicle that is overdue for maintenance."""

    office = OfficeSerializer(read_only=True)
    last_maintenance_date = serializers.DateField(read_only=True, allow_null=True)

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "vin",
            "license_plate",
            "make",
            "model",
            "year",
            "is_active",
            "office",
            "last_maintenance_date",
        ]


class MaintenanceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceRecord
        fields = [
            "id",
            "vehicle",
            "mechanic",
            "maintenance_date",
            "maintenance_type",
            "cost",
            "notes",
        ]


class AssignVehicleSerializer(serializers.Serializer):
    """Input payload for moving a vehicle to a new office."""

    office = serializers.PrimaryKeyRelatedField(queryset=Office.objects.all())
