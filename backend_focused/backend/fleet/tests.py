"""Tests for the Fleet Tracker API."""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import MaintenanceRecord, Mechanic, Office, Vehicle

TODAY = timezone.now().date()


class BaseAPITestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(
            username="tester", password="secret123"
        )

    def setUp(self):
        self.client.force_authenticate(user=self.user)


class AuthenticationTests(APITestCase):
    def setUp(self):
        get_user_model().objects.create_user(
            username="authuser", password="secret123"
        )

    def test_endpoints_require_authentication(self):
        response = self.client.get("/api/offices/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_obtain_refresh_and_use(self):
        obtain = self.client.post(
            "/api/token/",
            {"username": "authuser", "password": "secret123"},
            format="json",
        )
        self.assertEqual(obtain.status_code, status.HTTP_200_OK)
        self.assertIn("access", obtain.data)
        self.assertIn("refresh", obtain.data)

        authenticated = APIClient()
        authenticated.credentials(HTTP_AUTHORIZATION=f"Bearer {obtain.data['access']}")
        self.assertEqual(
            authenticated.get("/api/offices/").status_code, status.HTTP_200_OK
        )

        refreshed = self.client.post(
            "/api/token/refresh/",
            {"refresh": obtain.data["refresh"]},
            format="json",
        )
        self.assertEqual(refreshed.status_code, status.HTTP_200_OK)
        self.assertIn("access", refreshed.data)

    def test_invalid_credentials_are_rejected(self):
        response = self.client.post(
            "/api/token/",
            {"username": "authuser", "password": "wrong"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_forged_token_signed_with_attacker_key_is_rejected(self):
        """A token signed with a key other than the active SECRET_KEY is rejected."""
        import time

        import jwt as pyjwt
        from django.conf import settings

        user = get_user_model().objects.create_user(username="victim", password="secret123")
        attacker_key = "django-insecure--i^5bam1xi!k^$hyanp@-1kgey0aciz8=i55n@-pn5^!9jl8_c"

        self.assertNotEqual(settings.SECRET_KEY, attacker_key)

        now = int(time.time())
        forged = pyjwt.encode(
            {
                "token_type": "access",
                "exp": now + 600,
                "iat": now,
                "jti": "forged-access",
                "user_id": user.id,
            },
            attacker_key,
            algorithm="HS256",
        )

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {forged}")
        response = client.get("/api/offices/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class OfficeEndpointTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.office = Office.objects.create(name="New York", city="New York")
        self.active_a = Vehicle.objects.create(
            vin="VIN0000000000001",
            license_plate="AAA-1111",
            make="Toyota",
            model="Corolla",
            year=2020,
            office=self.office,
            is_active=True,
        )
        self.active_b = Vehicle.objects.create(
            vin="VIN0000000000002",
            license_plate="BBB-2222",
            make="Ford",
            model="F-150",
            year=2021,
            office=self.office,
            is_active=True,
        )
        self.inactive = Vehicle.objects.create(
            vin="VIN0000000000003",
            license_plate="CCC-3333",
            make="Ford",
            model="Focus",
            year=2018,
            office=self.office,
            is_active=False,
        )
        self.mechanic = Mechanic.objects.create(
            name="Jane", certification_number="CERT-1"
        )
        MaintenanceRecord.objects.create(
            vehicle=self.active_a,
            mechanic=self.mechanic,
            maintenance_date=TODAY - timedelta(days=10),
            maintenance_type="Oil Change",
            cost=Decimal("100.00"),
        )
        MaintenanceRecord.objects.create(
            vehicle=self.active_b,
            mechanic=self.mechanic,
            maintenance_date=TODAY - timedelta(days=500),
            maintenance_type="Brake Service",
            cost=Decimal("50.00"),
        )

    def test_office_crud(self):
        created = self.client.post(
            "/api/offices/", {"name": "Boston", "city": "Boston"}, format="json"
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        office_id = created.data["id"]

        detail = self.client.get(f"/api/offices/{office_id}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["name"], "Boston")

        updated = self.client.patch(
            f"/api/offices/{office_id}/", {"city": "Cambridge"}, format="json"
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["city"], "Cambridge")

        deleted = self.client.delete(f"/api/offices/{office_id}/")
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Office.objects.filter(pk=office_id).exists())

    def test_office_summary(self):
        response = self.client.get("/api/offices/summary/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        summary = next(item for item in response.data if item["id"] == self.office.id)
        self.assertEqual(summary["active_vehicle_count"], 2)
        self.assertEqual(Decimal(summary["maintenance_cost_last_year"]), Decimal("100.00"))
        self.assertEqual(summary["last_maintenance"], str(TODAY - timedelta(days=10)))

    def test_office_summary_for_empty_office(self):
        office = Office.objects.create(name="Empty", city="Nowhere")
        response = self.client.get("/api/offices/summary/")
        summary = next(item for item in response.data if item["id"] == office.id)
        self.assertEqual(summary["active_vehicle_count"], 0)
        self.assertEqual(Decimal(summary["maintenance_cost_last_year"]), Decimal("0"))
        self.assertIsNone(summary["last_maintenance"])


class VehicleEndpointTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.office1 = Office.objects.create(name="Office One", city="Boston")
        self.office2 = Office.objects.create(name="Office Two", city="Denver")
        self.mechanic_a = Mechanic.objects.create(
            name="Alice", certification_number="CERT-A"
        )
        self.mechanic_b = Mechanic.objects.create(
            name="Bob", certification_number="CERT-B"
        )

    def _vehicle(self, **overrides):
        defaults = {
            "vin": "VIN0000000000001",
            "license_plate": "AAA-1111",
            "make": "Toyota",
            "model": "Corolla",
            "year": 2020,
            "office": self.office1,
            "is_active": True,
        }
        defaults.update(overrides)
        return Vehicle.objects.create(**defaults)

    def test_vehicle_crud(self):
        payload = {
            "vin": "VIN0000000000100",
            "license_plate": "ZZZ-9999",
            "make": "Honda",
            "model": "Civic",
            "year": 2022,
            "office": self.office1.id,
            "is_active": True,
        }
        created = self.client.post("/api/vehicles/", payload, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        vehicle_id = created.data["id"]
        self.assertEqual(created.data["office_name"], self.office1.name)

        updated = self.client.patch(
            f"/api/vehicles/{vehicle_id}/", {"is_active": False}, format="json"
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertFalse(updated.data["is_active"])

        deleted = self.client.delete(f"/api/vehicles/{vehicle_id}/")
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)

    def test_duplicate_vin_is_rejected(self):
        self._vehicle(vin="VINDUPLICATE00001", license_plate="AAA-1111")
        response = self.client.post(
            "/api/vehicles/",
            {
                "vin": "vinduplicate00001",
                "license_plate": "NEW-0001",
                "make": "Kia",
                "model": "Rio",
                "year": 2019,
                "office": self.office1.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("vin", response.data)

    def test_duplicate_active_license_plate_is_rejected(self):
        self._vehicle(vin="VIN0000000000201", license_plate="PLATE-1234")
        response = self.client.post(
            "/api/vehicles/",
            {
                "vin": "VIN0000000000202",
                "license_plate": "plate-1234",
                "make": "Kia",
                "model": "Rio",
                "year": 2019,
                "office": self.office1.id,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("license_plate", response.data)

    def test_inactive_vehicle_plate_can_be_reused(self):
        self._vehicle(
            vin="VIN0000000000301", license_plate="SHARED-1", is_active=False
        )
        response = self.client.post(
            "/api/vehicles/",
            {
                "vin": "VIN0000000000302",
                "license_plate": "SHARED-1",
                "make": "Kia",
                "model": "Rio",
                "year": 2019,
                "office": self.office1.id,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_database_constraint_blocks_duplicate_active_plate(self):
        self._vehicle(vin="VIN0000000000401", license_plate="DB-CONST")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self._vehicle(vin="VIN0000000000402", license_plate="DB-CONST")

    def test_vehicle_filters(self):
        v1 = self._vehicle(
            vin="VIN0000000000501", license_plate="FIL-0001", make="Toyota",
            model="Corolla", office=self.office1,
        )
        v2 = self._vehicle(
            vin="VIN0000000000502", license_plate="FIL-0002", make="Ford",
            model="Focus", office=self.office2,
        )
        self._vehicle(
            vin="VIN0000000000503", license_plate="FIL-0003", make="Toyota",
            model="Corolla", office=self.office1, is_active=False,
        )
        MaintenanceRecord.objects.create(
            vehicle=v1, mechanic=self.mechanic_a,
            maintenance_date=TODAY - timedelta(days=5),
            maintenance_type="Oil Change", cost=Decimal("80.00"),
        )
        MaintenanceRecord.objects.create(
            vehicle=v2, mechanic=self.mechanic_b,
            maintenance_date=TODAY - timedelta(days=400),
            maintenance_type="Brake Service", cost=Decimal("200.00"),
        )

        def vins(query):
            response = self.client.get(f"/api/vehicles/?{query}")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            return {row["vin"] for row in response.data["results"]}

        self.assertEqual(
            vins(f"office={self.office1.id}"),
            {"VIN0000000000501", "VIN0000000000503"},
        )
        self.assertEqual(
            vins("active=true"), {"VIN0000000000501", "VIN0000000000502"}
        )
        self.assertEqual(
            vins("make=Toyota"), {"VIN0000000000501", "VIN0000000000503"}
        )
        self.assertEqual(vins("model=Focus"), {"VIN0000000000502"})
        self.assertEqual(
            vins("mechanic_certification_number=CERT-A"), {"VIN0000000000501"}
        )
        self.assertEqual(
            vins(f"maintenance_from={TODAY - timedelta(days=30)}"),
            {"VIN0000000000501"},
        )
        self.assertEqual(
            vins(f"maintenance_to={TODAY - timedelta(days=30)}"),
            {"VIN0000000000502"},
        )
        self.assertEqual(
            vins(f"office={self.office1.id}&active=true&make=Toyota"),
            {"VIN0000000000501"},
        )

    def test_invalid_filter_returns_bad_request(self):
        self.assertEqual(
            self.client.get("/api/vehicles/?office=abc").status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            self.client.get("/api/vehicles/?maintenance_from=13-01-2020").status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_date_filters_require_a_single_service_in_range(self):
        vehicle = self._vehicle(vin="VIN0000000000601", license_plate="SVC-0001")
        MaintenanceRecord.objects.create(
            vehicle=vehicle, mechanic=self.mechanic_a,
            maintenance_date=date(2020, 1, 1),
            maintenance_type="Oil Change", cost=Decimal("80.00"),
        )
        MaintenanceRecord.objects.create(
            vehicle=vehicle, mechanic=self.mechanic_a,
            maintenance_date=date(2026, 1, 1),
            maintenance_type="Brake Service", cost=Decimal("120.00"),
        )

        # No service falls inside this window, so the vehicle must not match.
        response = self.client.get(
            "/api/vehicles/?maintenance_from=2023-01-01&maintenance_to=2023-12-31"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row["vin"] for row in response.data["results"]], [])

        # A window containing a service does match.
        response = self.client.get(
            "/api/vehicles/?maintenance_from=2025-01-01&maintenance_to=2026-12-31"
        )
        self.assertEqual(
            [row["vin"] for row in response.data["results"]], [vehicle.vin]
        )

    def test_mechanic_and_date_filters_match_the_same_service(self):
        vehicle = self._vehicle(vin="VIN0000000000602", license_plate="SVC-0002")
        MaintenanceRecord.objects.create(
            vehicle=vehicle, mechanic=self.mechanic_a,
            maintenance_date=date(2020, 1, 1),
            maintenance_type="Oil Change", cost=Decimal("80.00"),
        )
        MaintenanceRecord.objects.create(
            vehicle=vehicle, mechanic=self.mechanic_b,
            maintenance_date=date(2024, 6, 1),
            maintenance_type="Brake Service", cost=Decimal("120.00"),
        )

        # CERT-A did not service the vehicle in 2024, so no match.
        response = self.client.get(
            "/api/vehicles/?mechanic_certification_number=CERT-A"
            "&maintenance_from=2024-01-01&maintenance_to=2024-12-31"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row["vin"] for row in response.data["results"]], [])

        # CERT-B serviced the vehicle in 2024, so it matches.
        response = self.client.get(
            "/api/vehicles/?mechanic_certification_number=CERT-B"
            "&maintenance_from=2024-01-01&maintenance_to=2024-12-31"
        )
        self.assertEqual(
            [row["vin"] for row in response.data["results"]], [vehicle.vin]
        )

    def test_reversed_maintenance_interval_is_rejected(self):
        response = self.client.get(
            "/api/vehicles/?maintenance_from=2024-12-31&maintenance_to=2024-01-01"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class VehicleDetailTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.office = Office.objects.create(name="Detail Office", city="Austin")
        self.other_office = Office.objects.create(name="Other Office", city="Dallas")
        self.mechanic = Mechanic.objects.create(
            name="Mia", certification_number="CERT-DETAIL"
        )

    def _make_vehicle(self, vin, records=0):
        vehicle = Vehicle.objects.create(
            vin=vin,
            license_plate=f"PLT-{vin[-4:]}",
            make="Toyota",
            model="Corolla",
            year=2020,
            office=self.office,
        )
        for index in range(records):
            MaintenanceRecord.objects.create(
                vehicle=vehicle,
                mechanic=self.mechanic,
                maintenance_date=TODAY - timedelta(days=index),
                maintenance_type="Oil Change",
                cost=Decimal("100.00"),
            )
        return vehicle

    def test_vehicle_detail_includes_office_and_history(self):
        vehicle = self._make_vehicle("VIN0000000000601", records=3)

        response = self.client.get(f"/api/vehicles/{vehicle.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["office"]["name"], self.office.name)
        self.assertEqual(len(response.data["maintenance_history"]), 3)
        self.assertEqual(
            response.data["maintenance_history"][0]["mechanic"]["name"],
            self.mechanic.name,
        )

    def test_history_endpoint_is_newest_first(self):
        vehicle = self._make_vehicle("VIN0000000000602", records=3)

        response = self.client.get(f"/api/vehicles/{vehicle.id}/history/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        dates = [row["maintenance_date"] for row in response.data]
        self.assertEqual(dates, sorted(dates, reverse=True))

    def test_detail_query_count_is_independent_of_history_size(self):
        small = self._make_vehicle("VIN0000000000603", records=2)
        large = self._make_vehicle("VIN0000000000604", records=40)

        with CaptureQueriesContext(connection) as small_ctx:
            self.client.get(f"/api/vehicles/{small.id}/")
        with CaptureQueriesContext(connection) as large_ctx:
            self.client.get(f"/api/vehicles/{large.id}/")

        self.assertEqual(len(small_ctx), len(large_ctx))


class VehicleAssignTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.office = Office.objects.create(name="From", city="Boston")
        self.new_office = Office.objects.create(name="To", city="Denver")
        self.vehicle = Vehicle.objects.create(
            vin="VIN0000000000701",
            license_plate="MOV-0001",
            make="Ford",
            model="Focus",
            year=2019,
            office=self.office,
        )

    def test_assign_moves_vehicle_to_new_office(self):
        response = self.client.post(
            f"/api/vehicles/{self.vehicle.id}/assign/",
            {"office": self.new_office.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.office_id, self.new_office.id)

    def test_assign_requires_a_valid_office(self):
        response = self.client.post(
            f"/api/vehicles/{self.vehicle.id}/assign/",
            {"office": 999999},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class NeedingMaintenanceTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.office = Office.objects.create(name="Fleet", city="Seattle")
        self.mechanic = Mechanic.objects.create(
            name="Nick", certification_number="CERT-NEED"
        )

    def _vehicle(self, vin, plate, is_active=True):
        return Vehicle.objects.create(
            vin=vin, license_plate=plate, make="Ford", model="Focus",
            year=2018, office=self.office, is_active=is_active,
        )

    def _service(self, vehicle, days_ago):
        MaintenanceRecord.objects.create(
            vehicle=vehicle, mechanic=self.mechanic,
            maintenance_date=TODAY - timedelta(days=days_ago),
            maintenance_type="Oil Change", cost=Decimal("75.00"),
        )

    def test_needing_maintenance_returns_overdue_and_never_serviced(self):
        never = self._vehicle("VIN0000000000801", "NEED-0001")
        overdue = self._vehicle("VIN0000000000802", "NEED-0002")
        fresh = self._vehicle("VIN0000000000803", "NEED-0003")
        inactive = self._vehicle("VIN0000000000804", "NEED-0004", is_active=False)
        self._service(overdue, 400)
        self._service(fresh, 10)

        response = self.client.get("/api/vehicles/needing-maintenance/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        vins = [row["vin"] for row in response.data]
        self.assertIn(never.vin, vins)
        self.assertIn(overdue.vin, vins)
        self.assertNotIn(fresh.vin, vins)
        self.assertNotIn(inactive.vin, vins)

        # Never-serviced vehicles (no last maintenance date) come first.
        self.assertEqual(vins[0], never.vin)

    def test_vehicle_serviced_365_days_ago_is_not_overdue(self):
        vehicle = self._vehicle("VIN0000000000805", "NEED-0005")
        self._service(vehicle, 365)

        response = self.client.get("/api/vehicles/needing-maintenance/")
        vins = [row["vin"] for row in response.data]
        self.assertNotIn(vehicle.vin, vins)


class DuplicateCheckTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.office = Office.objects.create(name="Dup", city="Miami")
        self.vehicle = Vehicle.objects.create(
            vin="VIN0000000000901", license_plate="DUP-0001",
            make="Kia", model="Rio", year=2020, office=self.office,
        )

    def test_reports_both_conflicts(self):
        response = self.client.get(
            "/api/vehicles/check-duplicate/?vin=VIN0000000000901"
            "&license_plate=DUP-0001"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(response.data["conflicts"]), {"vin", "license_plate"}
        )

    def test_reports_single_conflict(self):
        response = self.client.get(
            "/api/vehicles/check-duplicate/?license_plate=DUP-0001"
        )
        self.assertEqual(response.data["conflicts"], ["license_plate"])

    def test_exclude_id_ignores_the_vehicle_itself(self):
        response = self.client.get(
            f"/api/vehicles/check-duplicate/?vin=VIN0000000000901"
            f"&exclude_id={self.vehicle.id}"
        )
        self.assertEqual(response.data["conflicts"], [])

    def test_no_conflicts(self):
        response = self.client.get(
            "/api/vehicles/check-duplicate/?vin=UNIQUEVIN0000000&license_plate=NEW-9"
        )
        self.assertEqual(response.data["conflicts"], [])

    def test_requires_at_least_one_parameter(self):
        response = self.client.get("/api/vehicles/check-duplicate/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class MechanicWorkloadTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.office = Office.objects.create(name="Workload", city="Chicago")
        self.vehicle = Vehicle.objects.create(
            vin="VIN0000000001001", license_plate="WRK-0001",
            make="Toyota", model="Camry", year=2020, office=self.office,
        )

    def _record(self, mechanic, when, cost):
        return MaintenanceRecord.objects.create(
            vehicle=self.vehicle, mechanic=mechanic, maintenance_date=when,
            maintenance_type="Oil Change", cost=Decimal(cost),
        )

    def test_workload_counts_current_year_only_and_orders_by_busyness(self):
        year = TODAY.year
        busy = Mechanic.objects.create(name="Busy", certification_number="C-BUSY")
        idle = Mechanic.objects.create(name="Idle", certification_number="C-IDLE")
        self._record(busy, date(year, 1, 1), "100.00")
        self._record(busy, TODAY, "50.00")
        self._record(busy, date(year - 1, 6, 1), "999.00")

        response = self.client.get("/api/mechanics/workload/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        rows = {row["certification_number"]: row for row in response.data}
        self.assertEqual(rows["C-BUSY"]["maintenance_count"], 2)
        self.assertEqual(Decimal(rows["C-BUSY"]["total_cost"]), Decimal("150.00"))
        self.assertEqual(rows["C-IDLE"]["maintenance_count"], 0)
        self.assertEqual(Decimal(rows["C-IDLE"]["total_cost"]), Decimal("0"))

        order = [row["certification_number"] for row in response.data]
        self.assertLess(order.index("C-BUSY"), order.index("C-IDLE"))


class MaintenanceRecordTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.office = Office.objects.create(name="Records", city="Phoenix")
        self.vehicle = Vehicle.objects.create(
            vin="VIN0000000001101", license_plate="REC-0001",
            make="Honda", model="Accord", year=2021, office=self.office,
        )
        self.mechanic = Mechanic.objects.create(
            name="Rex", certification_number="C-REC"
        )

    def test_maintenance_record_crud(self):
        payload = {
            "vehicle": self.vehicle.id,
            "mechanic": self.mechanic.id,
            "maintenance_date": str(TODAY),
            "maintenance_type": "Oil Change",
            "cost": "120.50",
            "notes": "Routine service",
        }
        created = self.client.post(
            "/api/maintenance-records/", payload, format="json"
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        record_id = created.data["id"]

        detail = self.client.get(f"/api/maintenance-records/{record_id}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(detail.data["cost"]), Decimal("120.50"))

        updated = self.client.patch(
            f"/api/maintenance-records/{record_id}/",
            {"cost": "130.00"},
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(updated.data["cost"]), Decimal("130.00"))

        deleted = self.client.delete(f"/api/maintenance-records/{record_id}/")
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)

    def test_negative_cost_is_rejected(self):
        response = self.client.post(
            "/api/maintenance-records/",
            {
                "vehicle": self.vehicle.id,
                "mechanic": self.mechanic.id,
                "maintenance_date": str(TODAY),
                "maintenance_type": "Oil Change",
                "cost": "-5.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cost", response.data)

    def test_record_requires_an_existing_vehicle(self):
        response = self.client.post(
            "/api/maintenance-records/",
            {
                "vehicle": 999999,
                "mechanic": self.mechanic.id,
                "maintenance_date": str(TODAY),
                "maintenance_type": "Oil Change",
                "cost": "10.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("vehicle", response.data)


class MechanicCrudTests(BaseAPITestCase):
    def test_mechanic_crud(self):
        created = self.client.post(
            "/api/mechanics/",
            {"name": "New Mech", "certification_number": "C-NEW", "is_active": True},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        mechanic_id = created.data["id"]

        listing = self.client.get("/api/mechanics/")
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(listing.data["count"], 1)

        deleted = self.client.delete(f"/api/mechanics/{mechanic_id}/")
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
