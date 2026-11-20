# MediConnect Frontend

This folder contains the unified React 18, TypeScript, and Vite MediConnect frontend.

## Run locally

From this folder, install the locked dependencies and start Vite:

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite to see the public MediConnect landing page. After signing in, role-specific dashboards provide access to platform features. Any sample dashboard data is labeled **Sample data · not live** and is not hospital data.

## Public landing page

The unauthenticated home page introduces MediConnect and links to sign-in and account creation. It describes patient features such as nearby hospital discovery, facility-reported beds, blood, oxygen and equipment availability, appointment requests, and in-app ambulance requests. It also outlines operational tools for healthcare teams, including staffing, resource updates, notifications, and activity history.

The landing page's resource overview is an illustration of the platform, not live hospital data. Actual resource availability depends on facility-reported updates. Sharing device location is optional and is used to estimate distance to listed hospitals. Ambulance requests go to a hospital's in-app dispatch team; MediConnect is not connected to an external ambulance provider or emergency service. In an emergency, contact local emergency services directly.

## Connect to Django

Start the backend separately, then choose **Sign in** and use an existing account. Access and refresh tokens are kept in memory only and are cleared when the page is refreshed or the user signs out. Expired access tokens are refreshed through `/api/auth/token/refresh/`.

Patients and professionals can create an account from the sign-in page. Hospital and platform administrator accounts must be created by an administrator.

After sign-in, each role is routed to its own dashboard. Patient navigation focuses on notifications, ambulance services, nearby hospitals, appointment booking, profile settings, and expandable hospital-resource availability for oxygen, blood, beds, and equipment. Nearby hospital distances use the patient's device location when shared; resource lists can be searched and filtered by hospital and type, and are sorted from highest to lowest availability. Administrators, hospital administrators, clinicians, nurses, and staff receive distinct operational shortcuts, live API-backed metrics, and actionable work queues; unavailable API data is identified rather than presented as zero. The shared workspace navigation groups tools by task, adapts to mobile screens, and provides account sign-out.

Patient accounts can open `/appointments` to request time with an available healthcare professional. Selecting a hospital from the patient resource display offers appointment and ambulance actions; hospital-specific bookings are limited to professionals affiliated with that hospital. Each request records the patient’s name, email or phone, appointment date/time, and duration; requests appear in the patient’s appointment list with their current status.

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
- `GET/POST /api/ambulance/referrals/` and `POST /api/ambulance/referrals/<id>/accept/` for structured interfacility triage, resource reservation, and linked transport
- `GET /api/hospitals/mine/` for the user's active facility memberships and facility role
- `GET /api/resources/burn-rates/?hours=24` for snapshot-derived resource depletion estimates
- `/api/driver-telemetry/` for one-use driver links and token exchange; the driver PWA streams GPS over WebSocket
- `/api/integrations/sms/inbound/`, `/api/integrations/ussd/callback/`, and `/api/integrations/resources/offline-updates/` for authorized fallback updates and offline sync

## Hospital maps and ambulance requests

Open `/hospitals`, allow device location, and select a hospital to view the Google Maps driving route, distance, and estimated travel time. Without a configured Maps key, the page shows direct-line distance and an external Google Maps link; driving route estimates require the key and Maps APIs listed above.

Open `/ambulance` to submit a transport request and track status, vehicle coordinates, and ETA. A hospital dispatcher can create a single-use driver link after dispatch; the driver opens it in a browser and, with location permission, streams GPS over WebSocket. Live coordinates expire after five minutes without an update and are not retained as route history. This remains an in-app workflow: there is no ambulance provider or emergency call-center integration, and dispatch status/ETA are not verified by an external fleet system. Emergency users must contact their local emergency service. `VITE_AMBULANCE_PHONE` optionally enables a click-to-call link.

## Interfacility referrals

Nurses and authorized source-facility staff can open `/referrals` to submit a structured triage handoff, select a receiving facility and requested resource, and view the referral status. A receiving-facility admin, manager, or coordinator can accept; acceptance reserves the requested resource and creates a linked ambulance request. The transport map shows the source-to-receiving-facility route and the driver's live position when available. Clinical triage remains online-only and is not placed in the offline cache.

Facility lists display master registry codes, level, ownership, county/sub-county, and available rankings when supplied. Registry records are imported by an administrator from a validated CSV; live authoritative registry synchronization is not configured.

## Organs resource category

The backend migration adds the **Organs** category and kidney, liver, heart, and lung resource types. No hospital stock is seeded for organs, so the catalog does not claim donor or organ availability. Any real availability must come from verified clinical systems and authorized staff.

## Oxygen monitoring

Open `/oxygen` in the frontend to view the Oxygen Monitoring dashboard. Without a connected account it shows clearly labelled demonstration data. After signing in with **Connect live data**, it reads the documented `GET /api/resources/oxygen/` endpoint. Low-level warnings use the backend's `is_low` field; an empty reported supply is highlighted as critical. The current oxygen API reports available unit counts, but not equipment operational health, so the live dashboard labels this distinction rather than claiming a unit is operational.

## Resource management

Open `/resources` to review and filter hospital resource inventory. When disconnected, the screen displays clearly labelled sample data and disables stock changes. After connecting with an account authorized by the backend, the page reads `GET /api/resources/stocks/` and lets authorized users record `ADD`, `REMOVE`, `RESERVE`, or `RELEASE` adjustments through `POST /api/resources/stocks/<id>/adjust/`. The backend enforces permissions and writes the audit transaction. The API currently documents no resource-creation UI in this frontend.

## Audit Centre

Open `/audit` to inspect resource transaction history. After connecting with an authenticated account, choose a resource to fetch `GET /api/resources/stocks/<id>/transactions/`. The backend returns up to 50 transactions for that resource; this is not a complete system-wide audit trail. Without a live connection the page does not show demonstration audit records.

## Analytics dashboard

Open `/analytics` to view facility-filtered summaries of current resource inventory and oxygen supplies plus resource burn-rate estimates. The dashboard calculates time-series estimates from hourly snapshots returned by `GET /api/resources/burn-rates/?hours=24`; projections are unavailable until two snapshots span at least an hour and should be treated as operational estimates, not predictions. CSV export includes current inventory and oxygen records, not the snapshot history. API errors are shown explicitly and partial data is identified.

## Reports

Open `/reports` to view current resource inventory (`GET /api/resources/stocks/`), blood stock (`GET /api/resources/blood/`), and oxygen supply (`GET /api/resources/oxygen/`) records. Filter by report type and facility, then export the visible fetched records as CSV. The backend does not provide report-generation or historical-period endpoints, so reports reflect current API records only. If one endpoint fails, its error is shown and any successful report data is labeled partial; demonstration records are never substituted.

## System settings

Open `/settings` while connected to manage the authenticated account profile through `GET/PATCH /api/auth/profile/`, change the password through `POST /api/auth/change-password/`, manage notification preferences through `/api/preferences/`, and upload verification documents through `/api/auth/documents/`. Credential states distinguish queued checks from pending authorized KMPDC/registry access; the current adapter does not mark credentials verified. Email, role, and verification status are read-only. Password policy validation is enforced by the backend.

## Offline and low-bandwidth support

The service worker caches the app shell and public facility/resource snapshots; it does not cache clinical triage, patient records, or authentication tokens. Authorized staff can queue non-clinical resource quantity updates in IndexedDB. Sync submits an idempotency key and the last-seen resource timestamp; a stale update is returned as a conflict for review rather than silently overwriting newer data. Offline synchronization does not imply that cached availability is current.

SMS and USSD use normalized provider-neutral callbacks secured by separate webhook tokens. The structured `BED` and `O2` commands update counts only when the sender's registered phone belongs to an active facility manager/coordinator. Actual carrier/provider delivery requires an external adapter and credentials. M-Pesa configuration is present for integration planning, but payment checkout and all money movement are disabled.

## Staffing and notifications

Open `/staffing` to browse public contracts, submit bids, review bids (hospital admins), manage assignments, and check in or out of accepted shifts. Hospital administrators can also create and publish contracts and manage hospital, department, and staff records. `/notifications` shows account notifications and supports marking one or all as read. Available actions depend on the authenticated role and are enforced by the backend.

## Check changes

```powershell
npm test
npm run build
```
