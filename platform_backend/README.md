# Healthcare Staffing & Resource Platform API

**MediConnect / HealthStaff Hub** – A complete Django REST Framework backend that enables:

- **Doctors, Nurses & Specialists** to browse and bid on work contracts / shifts across hospitals
- **Hospitals** to post staffing needs, review bids, and assign professionals
- **Real-time tracking** of critical hospital resources: beds, blood stock, oxygen, medications & more
- Notifications for bids, low-stock alerts, assignment reminders, etc.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Quick Start](#quick-start)
5. [API Overview](#api-overview)
6. [Authentication](#authentication)
7. [Core Models](#core-models)
8. [Key Endpoints](#key-endpoints)
9. [Permissions & Roles](#permissions--roles)
10. [Resource Tracking](#resource-tracking)
11. [Notifications](#notifications)
12. [OpenAPI / Swagger Docs](#openapi--swagger-docs)
13. [Production Deployment Notes](#production-deployment-notes)
14. [License](#license)

---

## Features

### Staffing Marketplace
- Hospitals create **Work Contracts** (shifts, locum, on-call, short/long-term)
- Professionals filter by role, specialization, location, urgency, date
- Place **Bids** with proposed rate + cover message
- Hospital admins review, accept/reject bids
- Automatic assignment + rejection of other bids on acceptance
- Check-in / check-out for completed shifts
- Ratings & feedback

### Resource Management
- Generic **Hospital Resources** (beds of any type, medications, equipment…)
- Specialized **Blood Stock** (by group + component + batch/expiry)
- **Oxygen Supply** (cylinders, liquid, concentrators, pipeline) with level %
- Transaction audit log for every stock change
- Low-stock & critical alerts pushed as notifications

### User & Hospital Management
- Custom User model (email login) with roles: Doctor, Nurse, Specialist, Hospital Admin, Platform Admin
- Profile, documents for verification, availability status
- Multi-hospital staff memberships
- Departments per hospital

### Notifications
- In-app notifications for new matching contracts, bid updates, resource alerts, etc.
- Preference controls per user

### Care Coordination MVP
- Interfacility referrals with structured triage, receiving-facility review, atomic resource reservation, and linked ambulance requests
- One-use driver telemetry links, authenticated WebSocket location streaming, and short-lived Redis location data
- Hourly resource snapshots and a burn-rate endpoint backed by PostgreSQL/TimescaleDB
- Master facility registry fields and a validated CSV import command
- Asynchronous credential-verification jobs that remain pending until authorized KMPDC access is available
- Provider-neutral SMS and USSD callbacks for manager-authorized bed and oxygen count updates
- Offline app-shell/public-facility caching and idempotent, conflict-checked non-clinical resource updates
- M-Pesa configuration boundary only; checkout and money movement remain disabled

---

## Tech Stack

| Layer              | Technology                          |
|--------------------|-------------------------------------|
| Framework          | Django 5 / 6                        |
| API                | Django REST Framework               |
| Auth               | JWT (SimpleJWT)                     |
| Docs               | drf-spectacular (OpenAPI 3)         |
| CORS               | django-cors-headers                 |
| Real-time          | Django Channels + Redis             |
| Background jobs    | Celery + Redis                      |
| DB (local)         | SQLite or Compose PostgreSQL        |
| Time-series DB     | TimescaleDB (Compose)                |
| Media              | Pillow + local / S3                 |

---

## Project Structure

```
healthcare_platform/
├── config/                 # Project settings, root URLs, ASGI/WSGI
│   ├── settings.py
│   ├── urls.py
│   └── ...
├── accounts/               # Custom User, auth, documents
│   ├── models.py
│   ├── serializers.py
│   ├── views.py
│   ├── permissions.py
│   ├── urls.py
│   └── admin.py
├── hospitals/              # Hospitals, Departments, Staff links
├── contracts/              # WorkContract, Bid, ContractAssignment
├── resources/              # Categories, Types, Stocks, Blood, Oxygen
├── notifications/          # In-app notifications & preferences
├── manage.py
├── requirements.txt
├── .env.example
└── README.md
```

---

## Quick Start

### 1. Clone / Extract & Create Virtualenv

```bash
cd healthcare_platform
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment

```bash
cp .env.example .env
# Edit .env if needed (SECRET_KEY, DB, etc.)
```

### 3. Migrate & Create Superuser

```bash
python manage.py migrate
python manage.py createsuperuser   # uses email
```

### 4. (Optional) Seed development data

```bash
# On a fresh development database only; creates the core sample facilities and accounts.
python manage.py shell < scripts/seed_data.py
python manage.py seed_mvp_demo_data
```

The MVP seeder requires the sample facilities created by `scripts/seed_data.py` and refuses to run when `DEBUG` is disabled. It adds clearly synthetic patient, nurse, doctor, facility-manager, and staff accounts; a sample appointment; a pending interfacility referral; an en-route ambulance request; facility-registry demo fields; and two hourly resource snapshots for burn-rate testing. Referral acceptance through the receiving facility account exercises the resource reservation workflow.

On its first run, `seed_mvp_demo_data` prints a randomly generated, one-time password for any new demo accounts; all newly created accounts share it. Save it securely. The command never resets passwords for accounts that already exist. Demo accounts and data are for local development only. It does not fabricate credential verification, SMS/USSD activity, or M-Pesa transactions; those require their respective external configuration.

### 5. Run

```bash
python manage.py runserver
```

- API root: http://127.0.0.1:8000/api/
- Swagger UI: http://127.0.0.1:8000/api/docs/
- ReDoc: http://127.0.0.1:8000/api/redoc/
- Admin: http://127.0.0.1:8000/admin/

### Run the full local MVP stack

From the repository root, copy `.env.example` to `.env`, then start PostgreSQL/TimescaleDB, Redis, Daphne, Celery worker, and Celery beat:

```bash
docker compose up --build
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py setup_resource_snapshot_hypertable
```

The hourly snapshot task is scheduled by Celery beat. The hypertable setup command requires the TimescaleDB extension and should be run after migrations. Local Compose credentials are for development only.

---

## API Overview

All endpoints are under `/api/` and require a JWT Bearer token except registration & login.

| Prefix                  | App          | Description                          |
|-------------------------|--------------|--------------------------------------|
| `/api/auth/`            | accounts     | Register, login, profile, documents  |
| `/api/hospitals/`       | hospitals    | Hospitals CRUD                       |
| `/api/departments/`     | hospitals    | Departments                          |
| `/api/staff/`           | hospitals    | Hospital staff memberships           |
| `/api/contracts/`       | contracts    | Work contracts                       |
| `/api/bids/`            | contracts    | Bids on contracts                    |
| `/api/assignments/`     | contracts    | Final assignments + check-in/out     |
| `/api/resources/`       | resources    | Categories, types, stocks, blood, O₂ |
| `/api/notifications/`   | notifications| In-app notifications                 |
| `/api/ambulance/`      | ambulances   | Patient transport requests and tracking |
| `/api/ambulance/referrals/` | ambulances | Interfacility clinical referrals and acceptance |
| `/api/appointments/`   | appointments | Professional listings and patient bookings |
| `/api/history/`       | activity_ledger | Authenticated user activity history   |
| `/api/ledger/`        | activity_ledger | Read-only activity ledger              |
| `/api/driver-telemetry/` | driver_telemetry | One-use driver session and token exchange |
| `/api/integrations/`  | integrations | SMS/USSD callbacks and offline resource sync |
| `/api/resources/burn-rates/` | resources | Snapshot-based resource depletion estimates |

---

## Authentication

### Register (Patients and Professionals)

```http
POST /api/auth/register/
Content-Type: application/json

{
  "email": "dr.jane@example.com",
  "password": "SecurePass123!",
  "password_confirm": "SecurePass123!",
  "first_name": "Jane",
  "last_name": "Doe",
  "role": "DOCTOR",
  "phone": "+254700000000",
  "license_number": "KMPDB-12345",
  "specialization": "Cardiology",
  "years_of_experience": 8
}
```

Roles that can self-register: `PATIENT`, `DOCTOR`, `NURSE`, `SPECIALIST`, `STAFF`.  
`ADMIN` / `HOSPITAL_ADMIN` must be created by a superuser.

### Login

```http
POST /api/auth/login/
{
  "email": "dr.jane@example.com",
  "password": "SecurePass123!"
}
```

Response includes `access`, `refresh` tokens and the full user object.

### Authenticated requests

```http
Authorization: Bearer <access_token>
```

Refresh: `POST /api/auth/token/refresh/` with `{"refresh": "..."}`.

---

## Core Models

### User (accounts)
- Email-based authentication
- Roles: ADMIN, HOSPITAL_ADMIN, DOCTOR, NURSE, SPECIALIST, STAFF
- License, specialization, years of experience, availability status, verification flag

### Hospital / Department / HospitalStaff
- Full hospital profile + geo coordinates
- Departments linked to hospitals
- Users linked to one or more hospitals with role (Admin, Manager, Coordinator, Staff)

### WorkContract
- Type (Shift, Short-term, Long-term, On-call, Full-time)
- Required role & specialization, min experience
- Start/end datetime, budget range, urgency
- Status workflow: DRAFT → OPEN → FILLED / CLOSED → COMPLETED

### Bid
- One bid per professional per contract
- Proposed rate + message
- Status: PENDING → ACCEPTED / REJECTED / WITHDRAWN

### ContractAssignment
- Created automatically on bid acceptance
- Check-in / check-out timestamps
- Ratings from both sides

### Resources
- **ResourceCategory** (Beds, Blood, Oxygen, Medications, Equipment…)
- **ResourceType** (ICU Bed, General Ward Bed, A+ Whole Blood, 40L Cylinder…)
- **HospitalResource** – capacity, available, reserved, low-stock threshold
- **ResourceTransaction** – full audit trail
- **BloodStock** – group + component + batch + expiry
- **OxygenSupply** – type, capacity, current level, % remaining

---

## Key Endpoints

### Contracts

| Method | Endpoint                          | Description                     | Who              |
|--------|-----------------------------------|---------------------------------|------------------|
| GET    | `/api/contracts/`                 | List open contracts             | Professionals    |
| POST   | `/api/contracts/`                 | Create draft contract           | Hospital Admin   |
| POST   | `/api/contracts/{id}/publish/`    | Publish (DRAFT → OPEN)          | Hospital Admin   |
| POST   | `/api/contracts/{id}/close/`      | Close bidding                   | Hospital Admin   |
| GET    | `/api/contracts/{id}/`            | Detail                          | Authenticated    |

### Bids

| Method | Endpoint                    | Description                  | Who                |
|--------|-----------------------------|------------------------------|--------------------|
| POST   | `/api/bids/`                | Place a bid                  | Professional       |
| GET    | `/api/bids/`                | My bids / hospital’s bids    | Owner / Admin      |
| POST   | `/api/bids/{id}/review/`    | Accept or Reject             | Hospital Admin     |

Body for review:
```json
{"status": "ACCEPTED", "review_notes": "Looking forward to working with you."}
```

### Interfacility referrals

- `GET/POST /api/ambulance/referrals/` – source-hospital nurses or staff create structured referrals; facility members can view referrals for their facilities.
- `POST /api/ambulance/referrals/{id}/accept/` – receiving hospital admins, managers, or coordinators atomically reserve one matching resource record and create a linked ambulance request.
- Cancelling an accepted linked request releases the reservation and records a resource transaction.
- `GET /api/ambulance/requests/` exposes source and destination coordinates for referral transport maps.

The triage summary is clinical information: use only with authorized accounts, enter only transfer-relevant details, and do not cache it for offline use.

### Telemetry, fallback, and integrations

- `POST /api/driver-telemetry/sessions/` creates a one-use driver URL for an authorized, en-route request; `POST /api/driver-telemetry/exchange/` exchanges it once for a short-lived driver token.
- The driver PWA streams GPS over WebSocket to Redis. Location values expire after five minutes without an update and are not stored as route history. Patient and authorized source/receiving facility members can view a request's live stream.
- `POST /api/integrations/sms/inbound/` and `POST /api/integrations/ussd/callback/` accept normalized, provider-neutral callbacks secured by `X-Webhook-Token`. Structured commands are `BED <facility-code> <resource-id> <available-count>` and `O2 <facility-code> <supply-id> <available-units>`. The sender's phone must match an active facility manager/coordinator account.
- `POST /api/integrations/resources/offline-updates/` applies authorized queued resource updates using an idempotency key and expected resource timestamp; stale updates return HTTP 409 instead of overwriting newer values.
- `GET /api/resources/burn-rates/?hours=24` estimates depletion from snapshots and returns no projection until at least two samples span one hour.
- `MPESA_*` settings define an adapter boundary only. Payment checkout is disabled in this MVP; no charges or money movement occur.

Configure SMS and USSD tokens, gateway credentials, Redis, and KMPDC settings through environment variables. Provider-specific webhook formats still require an adapter; live external services are not configured by default.

### Resources

| Method | Endpoint                              | Description                     |
|--------|---------------------------------------|---------------------------------|
| GET    | `/api/resources/stocks/`              | All hospital resource levels    |
| POST   | `/api/resources/stocks/{id}/adjust/`  | Add / Remove / Reserve / etc.   |
| GET    | `/api/resources/blood/`               | Blood stock by group            |
| GET    | `/api/resources/oxygen/`              | Oxygen supplies                 |

Adjust body example:
```json
{
  "transaction_type": "REMOVE",
  "quantity": 2,
  "reason": "Patient admission – Ward 3",
  "reference": "ADM-2026-00421"
}
```

---

## Permissions & Roles

| Action                        | Patient | Doctor/Nurse/Specialist | Hospital Admin | Platform Admin |
|-------------------------------|---------|-------------------------|----------------|----------------|
| Register                      | Yes     | Yes                     | No*            | No*            |
| Request ambulance transport   | Yes     | Yes                     | Yes            | Yes            |
| Browse open contracts         | No      | Yes                     | Yes            | Yes            |
| Place bid                     | No      | Yes                     | No             | No             |
| Create / publish contracts    | No      | No                      | Yes            | Yes            |
| Review bids                   | No      | No                      | Yes            | Yes            |
| Manage hospital resources     | No      | No                      | Yes            | Yes            |
| View all users                | Limited | Limited                 | Yes            | Yes            |

\* Hospital & Platform admins are created via Django admin or management command.

---

## Resource Tracking

1. Create **ResourceCategory** (e.g. “Beds”, “Blood”, “Oxygen”, “Organs”) via admin or API.
2. Create **ResourceType** under a category (e.g. “ICU Bed”, “A+ RBC”).
3. Create **HospitalResource** linking a hospital + resource type + initial quantities.
4. Use the `/adjust/` action for every change – this keeps an immutable transaction log and triggers low-stock notifications when thresholds are crossed.

Blood and Oxygen have dedicated models for domain-specific fields (expiry, blood group, cylinder capacity, etc.).
The migrated Organs category tracks aggregate transplant resource data only. It must not be used to claim donor or organ availability without verified clinical-system data.

Facility registry CSV imports require master facility code, level 1–6, ownership, county/sub-county, and ranking columns. Validate before applying with `python manage.py import_facility_registry registry.csv --dry-run`; then run without `--dry-run` to upsert the records.

---

## Notifications

- Automatically created on: new bid, bid accepted/rejected, low/critical resource, etc.
- Endpoints:
  - `GET /api/notifications/` – list (filter by `is_read`)
  - `POST /api/notifications/{id}/mark_read/`
  - `POST /api/notifications/mark_all_read/`
  - `GET /api/notifications/unread_count/`
  - `GET/PATCH /api/preferences/` – user notification preferences

## Ambulance Requests

- `GET/POST /api/ambulance/requests/` – list the authenticated user’s requests or create a request for a destination hospital.
- `POST /api/ambulance/requests/{id}/dispatch/` – hospital dispatch team records an ambulance identifier, location, and ETA.
- `POST /api/ambulance/requests/{id}/location/` – authorized destination-hospital staff update location and ETA while en route.
- `POST /api/ambulance/requests/{id}/status/` – authorized staff advance a request to arrived, completed, or cancelled.
- `POST /api/ambulance/requests/{id}/cancel/` – requester cancels a request before dispatch.

Hospital staff can only manage requests for hospitals where they have an active ADMIN, MANAGER, or COORDINATOR membership. The included workflow is not connected to an ambulance provider or live GPS source; dispatchers enter tracking updates manually.

## Appointments

- `GET /api/appointments/professionals/` – list active healthcare professionals currently marked available.
- `GET/POST /api/appointments/bookings/` – patients list their own requests or submit a booking with the professional, optional hospital, date/time, duration, patient name, and at least one contact method.

`GET /api/appointments/professionals/?hospital=<id>` filters available professionals to active staff at that hospital. A booking that specifies a hospital must use a professional with an active membership there. Patients can view only their own bookings; professionals can view bookings assigned to them, and platform admins can view all bookings. New bookings start with `REQUESTED` status.

## User History and Activity Ledger

- `GET /api/history/` – list the authenticated user's activity.
- `GET /api/ledger/` – read the append-only activity ledger.
- Platform admins can read all users' entries or filter with `?user_id=<id>`. Other users always see only their own entries.

Successful API creates, updates, and deletes are recorded with the event type, endpoint, resource identifier, status code, and timestamp. Successful sign-ins and registrations are also recorded. Request bodies, credentials, and query strings are not stored. Both endpoints are read-only.

---

## OpenAPI / Swagger Docs

Interactive documentation is available at:

- **Swagger UI**: `/api/docs/`
- **ReDoc**: `/api/redoc/`
- **Raw schema**: `/api/schema/`

All endpoints are tagged and documented with request/response schemas.

---

## Production Deployment Notes

### PythonAnywhere (HTTP API)

The existing WSGI application can run on PythonAnywhere. Replace `YOURUSERNAME`
and the paths below with your actual account and checkout paths. Choose a
Python version supported by the installed Django version, and use that same
version for the virtualenv and web app.

1. In a PythonAnywhere Bash console, clone or upload the repository and create
   a virtualenv. For example, with a checkout at `~/MediConnect`:

   ```bash
   cd ~/MediConnect/platform_backend
   python3 -m venv ~/.virtualenvs/mediconnect
   source ~/.virtualenvs/mediconnect/bin/activate
   pip install -r requirements.txt
   cp .env.example .env
   ```

2. Edit `platform_backend/.env` on PythonAnywhere (do not commit it). Set a
   unique, strong `SECRET_KEY`, `DEBUG=False`, and `ALLOWED_HOSTS` to your
   actual web app hostname, for example `YOURUSERNAME.pythonanywhere.com`
   (use the EU hostname or custom domain if applicable). Set
   `FRONTEND_BASE_URL=https://medi-connect-drab.vercel.app` for driver
   links. This frontend and `https://platformfrontend-delta.vercel.app` are
   included in the CORS allowlist. Add any other frontend origins to
   `CORS_ALLOWED_ORIGINS` as a comma-separated list.
   Configure the database and other service credentials there as needed.

3. In the same activated virtualenv, run:

   ```bash
   python manage.py migrate
   python manage.py collectstatic --noinput
   python manage.py createsuperuser
   ```

4. On the PythonAnywhere **Web** tab, add a web app using **Manual
   configuration**, select the matching Python version and set its virtualenv
   to `/home/YOURUSERNAME/.virtualenvs/mediconnect`. Set the source code and
   working directory to `/home/YOURUSERNAME/MediConnect/platform_backend`.
   Edit the WSGI configuration linked from the Web tab to contain:

   ```python
   import sys

   path = '/home/YOURUSERNAME/MediConnect/platform_backend'
   if path not in sys.path:
       sys.path.insert(0, path)

   from config.wsgi import application
   ```

5. Add a static-files mapping from `/static/` to
   `/home/YOURUSERNAME/MediConnect/platform_backend/staticfiles`, then reload
   the web app. Visit `https://YOURUSERNAME.pythonanywhere.com/` and
   `/api/docs/` to check it. The root response should identify `MediConnect API`;
   if it does not, check the WSGI configuration and checkout path above.
   In Vercel, set `VITE_API_BASE_URL` to
   `https://YOURUSERNAME.pythonanywhere.com/api` and redeploy the frontend.

The WSGI setup serves HTTP only: driver telemetry WebSockets require a separate
ASGI deployment. PythonAnywhere's [ASGI support](https://help.pythonanywhere.com/pages/ASGICommandLine/)
is experimental; the current WebSocket origin validator and Redis setup also
need configuring for the frontend before that feature will work. Credential
verification, urgent-bid SMS, and resource snapshots need a reachable Redis
broker plus running Celery worker and beat; PythonAnywhere always-on tasks
require a paid account. External network restrictions may also apply.

Uploaded professional documents can contain sensitive information. Do not map
`/media/` as public static files: the default file storage does not enforce
the API's document permissions. Configure access-controlled storage and
delivery before using uploads with real data.

### General production guidance

1. Set `DEBUG=False`, strong `SECRET_KEY`, proper `ALLOWED_HOSTS`.
   On Vercel, enable access to system environment variables so `VERCEL_URL` is available; the current deployment hostname is added to `ALLOWED_HOSTS` automatically.
2. Switch to PostgreSQL (`psycopg2-binary` is already in requirements).
3. Use WhiteNoise or a CDN for static files; store media on S3 / GCS.
4. Run with Gunicorn + Nginx (or similar).
5. Enable HTTPS and secure JWT settings (short access token lifetime).
6. Configure real email backend (SendGrid, SES, etc.) for notifications.
7. Keep Celery/Redis supervised for credential jobs, urgent-bid SMS, and hourly resource snapshots.
8. Add rate limiting, monitoring (Sentry), and regular DB backups.
9. Configure authorized KMPDC access before representing uploaded credentials as verified; the current adapter explicitly leaves them pending.
10. Configure and validate SMS/USSD providers and the driver telemetry workflow with facility partners before production use.

---

## License

MIT – feel free to use, modify and build upon this foundation for your healthcare platform.

---

**Built with Django REST Framework · Ready for mobile & web frontends**
