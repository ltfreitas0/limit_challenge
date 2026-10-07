"""API views for the Fleet Tracker.

The four ``ModelViewSet`` classes provide CRUD endpoints. Domain specific
reports are exposed as extra ``@action`` routes so the collection endpoints
stay predictable.
"""

from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Exists, F, Max, OuterRef, Prefetch, Q, Subquery, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import MaintenanceRecord, Mechanic, Office, Vehicle
from .serializers import (
    AssignVehicleSerializer,
    MaintenanceRecordDetailSerializer,
    MaintenanceRecordSerializer,
    MechanicSerializer,
    MechanicWorkloadSerializer,
    OfficeSerializer,
    OfficeSummarySerializer,
    VehicleDetailSerializer,
    VehicleMaintenanceAlertSerializer,
    VehicleSerializer,
)

TRUE_VALUES = {"true", "1", "yes", "y"}
FALSE_VALUES = {"false", "0", "no", "n"}


def _parse_bool(value, field):
    normalized = str(value).strip().lower()
    if normalized in TRUE_VALUES:
        return True
    if normalized in FALSE_VALUES:
        return False
    raise ValidationError({field: "Expected a boolean value (true/false)."})


def _parse_date_param(value, field):
    parsed = parse_date(str(value))
    if parsed is None:
        raise ValidationError({field: "Invalid date. Use the ISO format YYYY-MM-DD."})
    return parsed


class OfficeViewSet(viewsets.ModelViewSet):
    queryset = Office.objects.all()
    serializer_class = OfficeSerializer

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Every office with fleet statistics.

        * number of active vehicles
        * total maintenance cost over the last 12 months
        * date of the most recent maintenance on any vehicle in the office
        """
        one_year_ago = timezone.now().date() - timedelta(days=365)

        active_vehicle_count = (
            Vehicle.objects.filter(office=OuterRef("pk"), is_active=True)
            .order_by()
            .values("office")
            .annotate(total=Count("pk"))
            .values("total")
        )
        last_year_cost = (
            MaintenanceRecord.objects.filter(
                vehicle__office=OuterRef("pk"),
                maintenance_date__gte=one_year_ago,
            )
            .order_by()
            .values("vehicle__office")
            .annotate(total=Sum("cost"))
            .values("total")
        )
        last_maintenance = (
            MaintenanceRecord.objects.filter(vehicle__office=OuterRef("pk"))
            .order_by()
            .values("vehicle__office")
            .annotate(latest=Max("maintenance_date"))
            .values("latest")
        )

        offices = Office.objects.annotate(
            active_vehicle_count=Coalesce(Subquery(active_vehicle_count), 0),
            maintenance_cost_last_year=Coalesce(
                Subquery(last_year_cost), Decimal("0")
            ),
            last_maintenance=Subquery(last_maintenance),
        )

        serializer = OfficeSummarySerializer(offices, many=True)
        return Response(serializer.data)


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.select_related("office")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return VehicleDetailSerializer
        return VehicleSerializer

    def get_queryset(self):
        queryset = Vehicle.objects.select_related("office")

        if self.action == "retrieve":
            # Load the whole history (newest first) with each mechanic in a
            # single extra query so vehicles with hundreds of records still
            # respond quickly.
            queryset = queryset.prefetch_related(
                Prefetch(
                    "maintenance_records",
                    queryset=MaintenanceRecord.objects.select_related(
                        "mechanic"
                    ).order_by("-maintenance_date", "-id"),
                )
            )
        elif self.action == "list":
            queryset = self._apply_filters(queryset)

        return queryset

    def _apply_filters(self, queryset):
        """Optional, combinable filters for ``GET /vehicles/``."""
        params = self.request.query_params

        office = params.get("office")
        if office:
            if not str(office).isdigit():
                raise ValidationError({"office": "Expected an office id (integer)."})
            queryset = queryset.filter(office_id=int(office))

        active = params.get("active")
        if active not in (None, ""):
            queryset = queryset.filter(is_active=_parse_bool(active, "active"))

        make = params.get("make")
        if make:
            queryset = queryset.filter(make__iexact=make)

        model = params.get("model")
        if model:
            queryset = queryset.filter(model__iexact=model)

        certification = params.get("mechanic_certification_number")
        maintenance_from = params.get("maintenance_from")
        maintenance_to = params.get("maintenance_to")

        # Parse dates up front so invalid values fail fast with a 400.
        from_date = (
            _parse_date_param(maintenance_from, "maintenance_from")
            if maintenance_from
            else None
        )
        to_date = (
            _parse_date_param(maintenance_to, "maintenance_to")
            if maintenance_to
            else None
        )

        # Reject reversed intervals instead of silently matching nothing.
        if from_date and to_date and from_date > to_date:
            raise ValidationError(
                {"maintenance_from": "must be on or before maintenance_to."}
            )

        # Mechanic/date filters describe a *single* service. Use one correlated
        # EXISTS so every predicate is evaluated against the same maintenance
        # record instead of separate reverse joins that can match different
        # records (and blow up into a large intermediate row set).
        if certification or from_date or to_date:
            record_kwargs = {"vehicle": OuterRef("pk")}
            if certification:
                record_kwargs["mechanic__certification_number__iexact"] = certification
            if from_date:
                record_kwargs["maintenance_date__gte"] = from_date
            if to_date:
                record_kwargs["maintenance_date__lte"] = to_date
            queryset = queryset.filter(
                Exists(MaintenanceRecord.objects.filter(**record_kwargs))
            )

        return queryset

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        """Maintenance history for a single vehicle, newest first."""
        vehicle = self.get_object()
        records = vehicle.maintenance_records.select_related("mechanic").order_by(
            "-maintenance_date", "-id"
        )
        serializer = MaintenanceRecordDetailSerializer(records, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        """Move a vehicle from one office to another."""
        vehicle = self.get_object()
        serializer = AssignVehicleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        vehicle.office = serializer.validated_data["office"]
        vehicle.save(update_fields=["office"])

        return Response(VehicleSerializer(vehicle).data)

    @action(detail=False, methods=["get"], url_path="needing-maintenance")
    def needing_maintenance(self, request):
        """Active vehicles never serviced or last serviced over 365 days ago."""
        cutoff = timezone.now().date() - timedelta(days=365)

        last_maintenance = (
            MaintenanceRecord.objects.filter(vehicle=OuterRef("pk"))
            .order_by("-maintenance_date", "-id")
            .values("maintenance_date")[:1]
        )

        vehicles = (
            Vehicle.objects.filter(is_active=True)
            .select_related("office")
            .annotate(last_maintenance_date=Subquery(last_maintenance))
            .filter(
                Q(last_maintenance_date__isnull=True)
                | Q(last_maintenance_date__lt=cutoff)
            )
            .order_by(F("last_maintenance_date").asc(nulls_first=True), "id")
        )

        serializer = VehicleMaintenanceAlertSerializer(vehicles, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="check-duplicate")
    def check_duplicate(self, request):
        """Report which of the provided identifiers already belong to a vehicle."""
        vin = request.query_params.get("vin", "").strip()
        license_plate = request.query_params.get("license_plate", "").strip()
        exclude_id = request.query_params.get("exclude_id")

        if not vin and not license_plate:
            raise ValidationError("Provide at least one of 'vin' or 'license_plate'.")

        conflicts = []

        if vin:
            matches = Vehicle.objects.filter(vin__iexact=vin)
            if exclude_id:
                matches = matches.exclude(pk=exclude_id)
            if matches.exists():
                conflicts.append("vin")

        if license_plate:
            matches = Vehicle.objects.filter(
                license_plate__iexact=license_plate, is_active=True
            )
            if exclude_id:
                matches = matches.exclude(pk=exclude_id)
            if matches.exists():
                conflicts.append("license_plate")

        return Response({"conflicts": conflicts})


class MechanicViewSet(viewsets.ModelViewSet):
    queryset = Mechanic.objects.all()
    serializer_class = MechanicSerializer

    @action(detail=False, methods=["get"])
    def workload(self, request):
        """Current-year workload per mechanic, busiest first."""
        current_year = timezone.now().year
        year_filter = Q(maintenance_records__maintenance_date__year=current_year)

        mechanics = Mechanic.objects.annotate(
            maintenance_count=Count("maintenance_records", filter=year_filter),
            total_cost=Coalesce(
                Sum("maintenance_records__cost", filter=year_filter),
                Decimal("0"),
            ),
        ).order_by("-maintenance_count", "-total_cost", "name")

        serializer = MechanicWorkloadSerializer(mechanics, many=True)
        return Response(serializer.data)


class MaintenanceRecordViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceRecord.objects.select_related("vehicle", "mechanic")
    serializer_class = MaintenanceRecordSerializer
