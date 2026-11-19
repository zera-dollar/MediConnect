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

---

## Tech Stack

| Layer              | Technology                          |
|--------------------|-------------------------------------|
| Framework          | Django 5 / 6                        |
| API                | Django REST Framework               |
| Auth               | JWT (SimpleJWT)                     |
| Docs               | drf-spectacular (OpenAPI 3)         |
| CORS               | django-cors-headers                 |
| DB (dev)           | SQLite                              |
| DB (prod)          | PostgreSQL (recommended)            |
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
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser   # uses email
```

### 4. (Optional) Seed sample data

```bash
python manage.py shell < scripts/seed_data.py   # if provided
# or use the admin panel to create hospitals, categories, etc.
```

### 5. Run

```bash
python manage.py runserver
```

- API root: http://127.0.0.1:8000/api/
- Swagger UI: http://127.0.0.1:8000/api/docs/
- ReDoc: http://127.0.0.1:8000/api/redoc/
- Admin: http://127.0.0.1:8000/admin/

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
| `/api/appointments/`   | appointments | Professional listings and patient bookings |

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
- `GET/POST /api/appointments/bookings/` – patients list their own requests or submit a booking with the professional, date/time, duration, patient name, and at least one contact method.

Patients can view only their own bookings; professionals can view bookings assigned to them, and platform admins can view all bookings. New bookings start with `REQUESTED` status.

---

## OpenAPI / Swagger Docs

Interactive documentation is available at:

- **Swagger UI**: `/api/docs/`
- **ReDoc**: `/api/redoc/`
- **Raw schema**: `/api/schema/`

All endpoints are tagged and documented with request/response schemas.

---

## Production Deployment Notes

1. Set `DEBUG=False`, strong `SECRET_KEY`, proper `ALLOWED_HOSTS`.
2. Switch to PostgreSQL (`psycopg2-binary` is already in requirements).
3. Use WhiteNoise or a CDN for static files; store media on S3 / GCS.
4. Run with Gunicorn + Nginx (or similar).
5. Enable HTTPS and secure JWT settings (short access token lifetime).
6. Configure real email backend (SendGrid, SES, etc.) for notifications.
7. Consider Celery + Redis for async notification delivery and scheduled reminders.
8. Add rate limiting, monitoring (Sentry), and regular DB backups.
9. Implement proper document verification workflow (admin approval of ProfessionalDocument).
10. For real-time bed/oxygen dashboards consider WebSockets (Django Channels) or polling.

---

## License

MIT – feel free to use, modify and build upon this foundation for your healthcare platform.

---

**Built with Django REST Framework · Ready for mobile & web frontends**
