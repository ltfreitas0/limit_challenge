"""Populate the database with realistic dummy fleet data.

Usage:
    python manage.py seed_data
    python manage.py seed_data --flush --vehicles 120 --records 600
"""

import random
import string
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from faker import Faker

from fleet.models import MaintenanceRecord, Mechanic, Office, Vehicle

# A VIN never contains the letters I, O or Q.
VIN_ALPHABET = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"

VEHICLE_MODELS = [
    ("Toyota", "Corolla"),
    ("Toyota", "Camry"),
    ("Ford", "F-150"),
    ("Ford", "Focus"),
    ("Honda", "Civic"),
    ("Honda", "Accord"),
    ("Chevrolet", "Silverado"),
    ("Chevrolet", "Malibu"),
    ("Nissan", "Altima"),
    ("Nissan", "Rogue"),
    ("BMW", "3 Series"),
    ("Mercedes-Benz", "Sprinter"),
    ("Volkswagen", "Jetta"),
    ("Hyundai", "Elantra"),
    ("Kia", "Sorento"),
]

MAINTENANCE_TYPES = [
    "Oil Change",
    "Tire Rotation",
    "Brake Service",
    "Battery Replacement",
    "Transmission Service",
    "Air Filter Replacement",
    "Coolant Flush",
    "Wheel Alignment",
    "Annual Inspection",
]

CITIES = [
    "New York",
    "Chicago",
    "Los Angeles",
    "Houston",
    "Phoenix",
    "Denver",
    "Seattle",
    "Boston",
    "Miami",
    "Atlanta",
]


def _random_vin():
    return "".join(random.choices(VIN_ALPHABET, k=17))


def _random_plate():
    letters = "".join(random.choices(string.ascii_uppercase, k=3))
    return f"{letters}-{random.randint(1000, 9999)}"


class Command(BaseCommand):
    help = "Seed the database with dummy offices, mechanics, vehicles and records."

    def add_arguments(self, parser):
        parser.add_argument("--offices", type=int, default=5)
        parser.add_argument("--mechanics", type=int, default=10)
        parser.add_argument("--vehicles", type=int, default=60)
        parser.add_argument("--records", type=int, default=300)
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete existing fleet data before seeding.",
        )
        parser.add_argument("--username", default="admin")
        parser.add_argument("--password", default="password")

    @transaction.atomic
    def handle(self, *args, **options):
        fake = Faker()

        if options["flush"]:
            MaintenanceRecord.objects.all().delete()
            Vehicle.objects.all().delete()
            Mechanic.objects.all().delete()
            Office.objects.all().delete()
            self.stdout.write(self.style.WARNING("Flushed existing fleet data."))

        self._create_user(options["username"], options["password"])

        offices = [
            Office.objects.create(name=f"{city} Depot", city=city)
            for city in random.sample(CITIES, k=min(options["offices"], len(CITIES)))
        ]

        mechanics = []
        for index in range(options["mechanics"]):
            mechanics.append(
                Mechanic.objects.create(
                    name=fake.name(),
                    certification_number=f"CERT-{10000 + index}",
                    is_active=random.random() > 0.1,
                )
            )

        vehicles = []
        used_vins = set()
        used_plates = set()
        for _ in range(options["vehicles"]):
            vin = self._unique(_random_vin, used_vins)
            plate = self._unique(_random_plate, used_plates)
            make, model = random.choice(VEHICLE_MODELS)
            vehicles.append(
                Vehicle.objects.create(
                    vin=vin,
                    license_plate=plate,
                    make=make,
                    model=model,
                    year=random.randint(2005, 2024),
                    office=random.choice(offices),
                    is_active=random.random() > 0.15,
                )
            )

        today = timezone.now().date()
        records = 0
        for _ in range(options["records"]):
            vehicle = random.choice(vehicles)
            # Give a handful of vehicles no maintenance history at all.
            if random.random() < 0.1:
                continue
            MaintenanceRecord.objects.create(
                vehicle=vehicle,
                mechanic=random.choice(mechanics),
                maintenance_date=today - timedelta(days=random.randint(0, 800)),
                maintenance_type=random.choice(MAINTENANCE_TYPES),
                cost=Decimal(random.randint(50, 5000)) + Decimal("0.50"),
                notes=fake.sentence(nb_words=8),
            )
            records += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(offices)} offices, {len(mechanics)} mechanics, "
                f"{len(vehicles)} vehicles and {records} maintenance records."
            )
        )

    @staticmethod
    def _unique(generator, seen):
        while True:
            value = generator()
            if value not in seen:
                seen.add(value)
                return value

    def _create_user(self, username, password):
        user_model = get_user_model()
        if user_model.objects.filter(username=username).exists():
            self.stdout.write(f"User '{username}' already exists, skipping.")
            return
        user_model.objects.create_superuser(
            username=username,
            email=f"{username}@example.com",
            password=password,
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Created superuser '{username}' (password: '{password}')."
            )
        )
