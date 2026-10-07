# Fleet Maintenance API

A REST API for managing a fleet of vehicles and their maintenance history, built with
**Django 5.2** and **Django REST Framework**. Authentication is provided by JWT via
`djangorestframework-simplejwt`.

All nine use cases from the brief are implemented, along with full CRUD for the four
resources, a Faker-powered seed command, and an automated test suite.

---

## Overview

- Four domain models: `Office`, `Vehicle`, `Mechanic`, `MaintenanceRecord`.
- Full CRUD for every resource through DRF `ModelViewSet`s mounted behind a router at `/api/`.
- Report/action endpoints for office summaries, vehicle search, vehicle details, history,
  assignment, mechanic workload, overdue vehicles and duplicate detection.
- Every endpoint requires a JWT, except the token endpoints.
- `python manage.py seed_data` fills the database with realistic dummy data (Faker).
- `python manage.py test fleet` runs 30 tests covering CRUD, validation, filtering,
  aggregates, authentication and query-count performance.

## Tech stack

| Concern | Choice |
| --- | --- |
| Language | Python 3.14 |
| Framework | Django 5.2 / Django REST Framework 3.17 |
| Authentication | djangorestframework-simplejwt 5.5 (JWT bearer) |
| Database | SQLite |
| Fake data | Faker 33 |
| CORS | django-cors-headers |

## Project structure

```
backend/
├── manage.py
├── requirements.txt
├── server/                              # project package
│   ├── settings.py                      # DRF + SIMPLE_JWT configuration
│   └── urls.py                          # token routes + /api/ include
└── fleet/                               # the app
    ├── models.py                        # Office, Vehicle, Mechanic, MaintenanceRecord
    ├── serializers.py                   # request/response serializers
    ├── views.py                         # ModelViewSets + @action reports
    ├── urls.py                          # DRF router -> /api/
    ├── admin.py
    ├── tests.py                         # 30 tests
    ├── migrations/
    └── management/commands/seed_data.py # dummy data generator
```

## Getting started

```bash
cd backend
python -m venv .venv
# Windows:      .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt

python manage.py migrate
python manage.py seed_data        # optional: dummy data + demo login
python manage.py runserver 0.0.0.0:8000
```

Set `DJANGO_SECRET_KEY` to a stable secret when running the server:

```bash
DJANGO_SECRET_KEY='a long random string' python manage.py runserver 0.0.0.0:8000
```

The key signs the JWT access/refresh tokens (HS256). When it is unset a random
ephemeral key is generated so no known signing key is committed to source — but that
ephemeral key changes on every restart, invalidating any previously issued tokens.

The API is then served from `http://localhost:8000/api/`.

### Demo credentials

`seed_data` creates a superuser so you have a login out of the box:

- default username: `admin`, default password: `password`

Override them (and the amount of data) with the command flags:

```bash
python manage.py seed_data --username bob --password s3cret \
  --offices 8 --mechanics 15 --vehicles 120 --records 600
python manage.py seed_data --flush      # wipe fleet data first
```

## Authentication

All endpoints require authentication. The project issues **JWT bearer tokens**.

```bash
# 1. Obtain a token pair
curl -X POST http://localhost:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'
# -> {"access": "<access-token>", "refresh": "<refresh-token>"}

# 2. Call any endpoint with the access token
curl http://localhost:8000/api/vehicles/ -H "Authorization: Bearer <access-token>"

# 3. Refresh an expired access token
curl -X POST http://localhost:8000/api/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<refresh-token>"}'
```

- `/api/token/` and `/api/token/refresh/` are the only public endpoints.
- Any unauthenticated request to a fleet endpoint returns `401 Unauthorized`.
- Access tokens live for **30 minutes**, refresh tokens for **1 day**
  (configurable in `server/settings.py` under `SIMPLE_JWT`).
- `SessionAuthentication` is also enabled, so you can explore the API in Django's
  browsable API after logging in at `/admin/`. That is also how you create users
  (`python manage.py createsuperuser`).

## API reference

Base URL: `/api/`

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` `POST` | `/api/offices/` | list / create offices |
| `GET` `PUT` `PATCH` `DELETE` | `/api/offices/{id}/` | retrieve / update / delete an office |
| `GET` | `/api/offices/summary/` | office statistics — case 2 |
| `GET` `POST` | `/api/vehicles/` | list (with filtering) / create vehicles |
| `GET` `PUT` `PATCH` `DELETE` | `/api/vehicles/{id}/` | detail incl. office + full history — case 4 |
| `GET` | `/api/vehicles/{id}/history/` | maintenance history, newest first — case 5 |
| `POST` | `/api/vehicles/{id}/assign/` | move a vehicle to another office — case 6 |
| `GET` | `/api/vehicles/needing-maintenance/` | overdue / never-serviced vehicles — case 8 |
| `GET` | `/api/vehicles/check-duplicate/` | duplicate VIN / plate check — case 9 |
| `GET` `POST` | `/api/mechanics/` | list / create mechanics |
| `GET` `PUT` `PATCH` `DELETE` | `/api/mechanics/{id}/` | retrieve / update / delete a mechanic |
| `GET` | `/api/mechanics/workload/` | current-year workload, busiest first — case 7 |
| `GET` `POST` | `/api/maintenance-records/` | list / create maintenance records |
| `GET` `PUT` `PATCH` `DELETE` | `/api/maintenance-records/{id}/` | retrieve / update / delete a record |
| `POST` | `/api/token/` | obtain a JWT pair *(public)* |
| `POST` | `/api/token/refresh/` | refresh an access token *(public)* |

The standard CRUD list endpoints are **paginated** (10 per page) and return
`{"count": n, "next": url, "previous": url, "results": [...]}`. The report/action
endpoints (`summary`, `workload`, `needing-maintenance`, `history`) return a plain JSON
array, matching the shapes shown in the brief.

### Vehicle filtering — `GET /api/vehicles/`

Case 3 (vehicle search) is implemented as optional, combinable query parameters on the
collection endpoint, which is the REST-idiomatic way to filter a list.

| Query parameter | Meaning |
| --- | --- |
| `office` | office id, e.g. `?office=3` |
| `active` | `true` / `false` |
| `make` | case-insensitive make match, e.g. `?make=Toyota` |
| `model` | case-insensitive model match |
| `mechanic_certification_number` | vehicles serviced by the mechanic holding this certification |
| `maintenance_from` | vehicles with maintenance on/after this ISO date (`YYYY-MM-DD`) |
| `maintenance_to` | vehicles with maintenance on/before this ISO date |

Examples:

```bash
# active Toyotas serviced by a specific mechanic
/api/vehicles/?active=true&make=Toyota&mechanic_certification_number=CERT-A

# everything serviced in a date window for one office
/api/vehicles/?office=1&maintenance_from=2025-01-01&maintenance_to=2025-06-30
```

Invalid values (for example `?active=maybe`, `?office=abc` or `?maintenance_from=13-01-2020`)
return `400 Bad Request` with a descriptive message.

## Example responses

### `GET /api/offices/summary/` — case 2

```json
[
  {
    "id": 1,
    "name": "Boston Depot",
    "city": "Boston",
    "active_vehicle_count": 9,
    "maintenance_cost_last_year": "70168.50",
    "last_maintenance": "2026-09-29"
  }
]
```

### `GET /api/vehicles/{id}/` — case 4

```json
{
  "id": 12,
  "vin": "W9JBVXZU7WW1LSSXM",
  "license_plate": "AIB-9901",
  "make": "Kia",
  "model": "Sorento",
  "year": 2019,
  "is_active": true,
  "office": { "id": 1, "name": "Boston Depot", "city": "Boston" },
  "maintenance_history": [
    {
      "id": 301,
      "mechanic": {
        "id": 5,
        "name": "Devin Wise",
        "certification_number": "CERT-10004",
        "is_active": true
      },
      "maintenance_date": "2026-09-29",
      "maintenance_type": "Oil Change",
      "cost": "120.50",
      "notes": "Routine service"
    }
  ]
}
```

### `GET /api/vehicles/needing-maintenance/` — case 8

```json
[
  {
    "id": 57,
    "vin": "X58SA49CBC21BZX9N",
    "license_plate": "ZNV-3467",
    "make": "Ford",
    "model": "F-150",
    "year": 2005,
    "is_active": true,
    "office": { "id": 2, "name": "New York Depot", "city": "New York" },
    "last_maintenance_date": null
  }
]
```

### `GET /api/mechanics/workload/` — case 7

```json
[
  {
    "id": 5,
    "name": "Devin Wise",
    "certification_number": "CERT-10004",
    "maintenance_count": 13,
    "total_cost": "35192.50"
  },
  {
    "id": 9,
    "name": "Kevin Patterson",
    "certification_number": "CERT-10008",
    "maintenance_count": 12,
    "total_cost": "29182.00"
  }
]
```

### `GET /api/vehicles/check-duplicate/` — case 9

```bash
curl "http://localhost:8000/api/vehicles/check-duplicate/?vin=W9JBVXZU7WW1LSSXM&license_plate=AIB-9901" \
  -H "Authorization: Bearer <token>"
# -> {"conflicts": ["vin", "license_plate"]}
```

`exclude_id=<vehicle id>` is supported so an edit form can ignore the record being edited.

### `POST /api/vehicles/{id}/assign/` — case 6

```bash
curl -X POST http://localhost:8000/api/vehicles/12/assign/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"office": 3}'
```

## Seeding dummy data

```bash
python manage.py seed_data                                  # defaults
python manage.py seed_data --flush                          # clear fleet data first
python manage.py seed_data --offices 8 --vehicles 150 --records 900
```

The command creates a superuser, unique VINs and license plates, roughly 10% of vehicles
with no maintenance history at all, and maintenance dates spread over the last ~2 years so
the `needing-maintenance` and workload reports return meaningful data.

## Running the tests

```bash
cd backend
python manage.py test fleet
```

`fleet/tests.py` contains **30 tests**:

- **Authentication** — `401` without a token, token obtain/refresh/use, bad credentials.
- **Offices** — CRUD and the summary aggregates (including an empty office).
- **Vehicles** — CRUD, duplicate VIN, duplicate active plate, plate reuse once inactive,
  the database-level partial unique constraint, every search filter, invalid filters.
- **Vehicle detail / history** — office + history + mechanic nesting, newest-first ordering,
  and a query-count assertion proving there is no N+1 query in the detail endpoint.
- **Assignment** — moving a vehicle and rejecting an invalid office.
- **Mechanics** — CRUD and the current-year workload report.
- **Maintenance records** — CRUD, negative cost rejection, unknown-vehicle rejection.
- **Overdue vehicles / duplicate check** — edge cases (never serviced, exactly 365 days,
  inactive vehicles, `exclude_id`).

## Design decisions & tradeoffs

- **Search folded into the list endpoint.** Filtering is exposed as query parameters on
  `GET /api/vehicles/` instead of a separate `/vehicles/search/` route. It keeps the API
  idiomatic and composable, and the brief describes the filters as *optional*.
- **Integrity enforced in the database.** `Vehicle.vin` is `unique=True`; the "an active
  license plate is unique" rule is enforced by a **partial** `UniqueConstraint`
  (`license_plate` where `is_active=True`), so a plate can be reused once a vehicle is
  deactivated. Serializers additionally validate case-insensitively to return friendly
  `400` messages with a field name instead of a raw integrity error.
- **Aggregates computed in SQL, not Python.** The office summary uses correlated
  `Subquery`/`Coalesce` expressions rather than iterating vehicles. This avoids N+1 queries
  *and* the row-multiplication bug you get when mixing `Count` and `Sum` over two different
  multi-valued relations in one `GROUP BY`.
- **The detail endpoint is eager-loaded.** `select_related("office")` plus
  `Prefetch("maintenance_records", queryset=...select_related("mechanic"))` keeps the vehicle
  detail response at a constant number of queries regardless of history size — verified by a
  test that compares a 2-record vehicle with a 40-record one.
- **Hand-rolled query-param filtering.** `django-filter` is not in `requirements.txt`, so
  filtering is implemented directly with a small validation helper. No extra dependency, and
  invalid values produce clean `400`s.
- **JWT for authentication.** `djangorestframework-simplejwt` was added to `requirements.txt`.
  `DEFAULT_PERMISSION_CLASSES` is `IsAuthenticated`, and `SessionAuthentication` is kept so
  the browsable API remains usable.
- **JSON renderer restored.** The scaffold configured only `BrowsableAPIRenderer`, which makes
  DRF return `406 Not Acceptable` to JSON clients; `JSONRenderer` was added back alongside it.
- **Pagination on list endpoints only.** CRUD collections are paginated (10/page) for
  performance; the report endpoints return plain arrays to match the brief's example payloads.

## Assumptions

- A mechanic's `certification_number` is unique (it acts as the mechanic's natural key).
- "Last 12 months" and "current year" are evaluated against today's date at request time.
- "More than 365 days ago" is strict: a vehicle serviced exactly 365 days ago is **not**
  overdue.
- Money is stored as `Decimal(12, 2)` and serialized as a string to avoid float rounding.
- Vehicles are deactivated rather than deleted when they leave the fleet.
  - Deleting a vehicle cascades to its maintenance records.
  - Deleting an office is blocked (`PROTECT`) while it still owns vehicles.
  - A mechanic with maintenance records cannot be deleted (`PROTECT`).
- Public registration is intentionally **not** exposed. Create users with
  `python manage.py createsuperuser`, or use the demo user created by `seed_data`.


## Front-end features

The `frontend/` app is a complete client for this API (source lives in `app/` and `lib/`):

- **Auth (JWT):** sign in at `/login`. The access token is attached as a `Bearer` header and
  silently refreshed on `401` responses. Demo login: **admin / password**.
- **Vehicles:** paginated table with filters mirrored in the URL query string (`office`, `active`,
  `make`, `model`, `mechanic_certification_number`, `maintenance_from`, `maintenance_to`), full
  CRUD, a detail drawer with maintenance history, office reassignment
  (`POST /vehicles/{id}/assign/`) and an inline "add maintenance" action.
- **Offices:** CRUD plus the `GET /offices/summary/` statistics table.
- **Mechanics:** CRUD plus the `GET /mechanics/workload/` report.
- **Maintenance records:** CRUD with vehicle and mechanic dropdowns.

Every screen handles loading, empty and error states. Useful scripts: `npm run lint`,
`npm run format`, `npm run build`.