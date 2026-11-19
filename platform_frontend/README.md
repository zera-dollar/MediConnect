# MediConnect Frontend

This folder contains the unified React 18, TypeScript, and Vite MediConnect frontend.

## Run locally

From this folder, install the locked dependencies and start Vite:

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite. The dashboard starts in **Sample data · not live** mode; these demonstration figures are not hospital data.

## Connect to Django

Start the backend separately, then select **Connect live data** and sign in with an existing account. Access and refresh tokens are kept in memory only and are cleared when the page is refreshed or the user signs out. Expired access tokens are refreshed through `/api/auth/token/refresh/`.

Patients and professionals can create an account from the sign-in page. Hospital and platform administrator accounts must be created by an administrator.

Patient accounts can open `/appointments` to request time with an available healthcare professional. Each request records the patient’s name, email or phone, appointment date/time, and duration; requests appear in the patient’s appointment list with their current status.

The API base URL defaults to `http://127.0.0.1:8000/api`. Copy `.env.example` to `.env.local` to configure the API URL, `VITE_GOOGLE_MAPS_API_KEY`, and optional `VITE_AMBULANCE_PHONE`, then restart Vite. Restrict the Google Maps key to the frontend origins and enable Maps JavaScript API and Directions API with billing.

The dashboard uses routes found in the backend source:

- `POST /api/auth/login/` for JWT sign-in
- `GET /api/hospitals/` for the hospital selector
- `GET /api/hospitals/<id>/departments/` for unit labels
- `GET /api/resources/stocks/` for bed-resource counts
- `POST /api/resources/stocks/<id>/adjust/` for audited resource stock adjustments
- `GET /api/resources/stocks/<id>/transactions/` for up to 50 transactions for one selected resource
- `GET /api/resources/oxygen/` for oxygen supply records
- `GET/POST /api/contracts/` and `POST /api/contracts/<id>/publish/` or `/close/` for staffing contracts
- `GET/POST /api/bids/` and `POST /api/bids/<id>/review/` for bidding and bid review
- `GET/PATCH /api/assignments/` and `POST /api/assignments/<id>/check_in/` or `/check_out/` for assignment tracking and feedback
- `GET/POST /api/notifications/` and notification read actions for the authenticated inbox
- `GET/PATCH /api/preferences/` for notification delivery preferences
- `GET/POST /api/ambulance/requests/` and request dispatch, status, location, and cancel actions for in-app ambulance workflow

ICU resources are identified when their category or resource type name contains “ICU”. Capacity, available, and reserved counts come from the resource serializer; occupied beds are calculated as capacity minus available and reserved. No patient-level data is requested.

## Hospital maps and ambulance requests

Open `/hospitals`, allow device location, and select a hospital to view the Google Maps driving route, distance, and estimated travel time. Without a configured Maps key, the page shows direct-line distance and an external Google Maps link; driving route estimates require the key and Maps APIs listed above.

Open `/ambulance` to submit a transport request and track status, vehicle coordinates, and dispatcher-provided ETA. Updates are polled every five seconds. This is an internal demonstration workflow: no ambulance provider, emergency call center, or vehicle GPS feed is integrated. Hospital dispatchers must enter vehicle location/status, and emergency users must contact their local emergency service. `VITE_AMBULANCE_PHONE` optionally enables a click-to-call link.

## Organs resource category

The backend migration adds the **Organs** category and kidney, liver, heart, and lung resource types. No hospital stock is seeded for organs, so the catalog does not claim donor or organ availability. Any real availability must come from verified clinical systems and authorized staff.

## Oxygen monitoring

Open `/oxygen` in the frontend to view the Oxygen Monitoring dashboard. Without a connected account it shows clearly labelled demonstration data. After signing in with **Connect live data**, it reads the documented `GET /api/resources/oxygen/` endpoint. Low-level warnings use the backend's `is_low` field; an empty reported supply is highlighted as critical. The current oxygen API reports available unit counts, but not equipment operational health, so the live dashboard labels this distinction rather than claiming a unit is operational.

## Resource management

Open `/resources` to review and filter hospital resource inventory. When disconnected, the screen displays clearly labelled sample data and disables stock changes. After connecting with an account authorized by the backend, the page reads `GET /api/resources/stocks/` and lets authorized users record `ADD`, `REMOVE`, `RESERVE`, or `RELEASE` adjustments through `POST /api/resources/stocks/<id>/adjust/`. The backend enforces permissions and writes the audit transaction. The API currently documents no resource-creation UI in this frontend.

## Audit Centre

Open `/audit` to inspect resource transaction history. After connecting with an authenticated account, choose a resource to fetch `GET /api/resources/stocks/<id>/transactions/`. The backend returns up to 50 transactions for that resource; this is not a complete system-wide audit trail. Without a live connection the page does not show demonstration audit records.

## Analytics dashboard

Open `/analytics` to view facility-filtered summaries of the current resource inventory and oxygen supply records. The dashboard computes metrics from `GET /api/resources/stocks/` and `GET /api/resources/oxygen/`; it does not use demonstration values. CSV export includes the successfully fetched records matching the selected facility, with resource quantities annotated by their unit. Resource counts are used instead of adding capacity or availability values across unlike measurement units. These endpoints expose current state rather than time-series analytics, so the dashboard does not claim historical trends; any API failure is shown explicitly, and partial data is identified as partial.

## Reports

Open `/reports` to view current resource inventory (`GET /api/resources/stocks/`), blood stock (`GET /api/resources/blood/`), and oxygen supply (`GET /api/resources/oxygen/`) records. Filter by report type and facility, then export the visible fetched records as CSV. The backend does not provide report-generation or historical-period endpoints, so reports reflect current API records only. If one endpoint fails, its error is shown and any successful report data is labeled partial; demonstration records are never substituted.

## System settings

Open `/settings` while connected to manage the authenticated account profile through `GET/PATCH /api/auth/profile/`, change the password through `POST /api/auth/change-password/`, manage notification preferences through `/api/preferences/`, and upload verification documents through `/api/auth/documents/`. Email, role, and verification status are read-only. Password policy validation is enforced by the backend. Application-wide settings are not provided by the backend.

## Staffing and notifications

Open `/staffing` to browse public contracts, submit bids, review bids (hospital admins), manage assignments, and check in or out of accepted shifts. Hospital administrators can also create and publish contracts and manage hospital, department, and staff records. `/notifications` shows account notifications and supports marking one or all as read. Available actions depend on the authenticated role and are enforced by the backend.

## Check changes

```powershell
npm test
npm run build
```

The focused tests cover ICU resource filtering, bed totals, occupancy, and empty-capacity handling.