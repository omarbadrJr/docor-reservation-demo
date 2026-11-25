# Implementation Plan

## Project: Doctor Appointment Booking Platform (MVP)

## 1. Development Rules

- Follow `AGENTS.md`, `SRS.md`, `IMPLEMENTATION-PLAN.md`, `docs/TECH_STACK.md`, `docs/PROJECT_STRUCTURE.md`, and `docs/UI_UX.md`.
- Implement the project incrementally, phase by phase.
- Do not skip phases or start future phases prematurely.
- Do not implement the entire application in one step.
- Test each phase before moving to the next.
- Keep the application functional throughout development.
- Do not introduce features outside the agreed MVP scope.
- If a requirement is unclear or documents conflict, stop and ask before making assumptions.
- Update the phase status table below when a phase starts or is completed.

---

## Phase Tracker

| Phase | Name | Status |
|---|---|---|
| Phase 1 | Project Setup | Completed |
| Phase 2 | Database Design | Completed |
| Phase 3 | Application Foundation | Completed |
| Phase 4 | Public Doctor Discovery | Not Started |
| Phase 5 | Scheduling and Availability | Not Started |
| Phase 6 | Appointment Booking | Not Started |
| Phase 7 | Booking Management | Not Started |
| Phase 8 | Authentication and Authorization | Not Started |
| Phase 9 | Owner Dashboard | Not Started |
| Phase 10 | Receptionist Dashboard | Not Started |
| Phase 11 | Testing and Quality Assurance | Not Started |
| Phase 12 | Final MVP Preparation | Not Started |

---

## Phase 1 — Project Setup

### Tasks
- Initialize a single Next.js (App Router) + React + TypeScript project.
- Configure Tailwind CSS.
- Install and configure `shadcn/ui` and `lucide-react`.
- Install supporting libraries (`@supabase/supabase-js`, `@supabase/ssr`, `zod`, `react-hook-form`, `@hookform/resolvers`, `date-fns`, `qrcode`, `@types/qrcode`).
- Configure ESLint and add `lint`, `typecheck`, and `build` scripts in `package.json`.
- Set up the initial folder structure following `docs/PROJECT_STRUCTURE.md` (only folders/files needed now).
- Create `.env.example` and configure `.env.local` (never commit secrets or expose `SUPABASE_SERVICE_ROLE_KEY` to client code).
- Connect to the Supabase project (hosted project or local Supabase setup) and configure browser/server/admin Supabase clients in `src/lib/supabase/`.
- Update the Commands section in `AGENTS.md` with the exact `npm` scripts.

### Acceptance Criteria
- Application runs locally (`npm run dev`).
- `npm run typecheck`, `npm run lint`, and `npm run build` pass with no errors.
- Supabase server and browser client configuration works and verifies connectivity.
- Environment variables are documented in `.env.example` and configured cleanly in `.env.local`.

---

## Phase 2 — Database Design

### Tasks
Design and implement version-controlled SQL migrations in `supabase/migrations/` for:
- `clinics`
- `specialties`
- `doctors` (1 `clinic_id`, 1 primary `specialty_id`, `consultation_fee`, `slot_duration_minutes`, `photo_url`, `is_active`, etc.)
- `weekly_schedules`
- `manual_availability`
- `schedule_exceptions` (distinguishing closed days vs. modified/extra working hours)
- `appointments` (`reference_number`, `qr_token`, `doctor_id`, `clinic_id`, `patient_name`, `patient_phone`, `appointment_date`, `start_time`, `end_time`, `status`, timestamps)
- `admin_profiles` (or `admin_users`) linked to `auth.users(id)` with `role` (`OWNER` | `RECEPTIONIST`), nullable `clinic_id` (required for receptionists), and `is_active` — no custom password hashes

Implement:
- Primary keys, foreign keys, and query indexes (doctor/date/status, reference, phone, clinic/date).
- Unique constraints on `appointments.reference_number` and `appointments.qr_token`.
- Appointment status enum/check constraint (`CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `CANCELLED`, `NO_SHOW`).
- PostgreSQL double-booking prevention (e.g., `btree_gist` exclusion constraint blocking overlapping active appointments for the same doctor where status is active, plus transactional PostgreSQL RPCs for atomic booking and rescheduling).
- Baseline Row Level Security (RLS) policies enforcing public read of active catalog data and server/role-scoped access to appointments and admin records.
- Public Supabase Storage bucket for doctor photographs; owner uploads use a server-side route with the service-role key.
- Fictional seed dataset in `supabase/seed.sql` meeting `SRS.md` §12 (>5 doctors, multiple clinics, several specialties, varied fees and weekly schedules, manual availability, schedule exceptions, sample bookings across statuses — clearly marked fictional).
- Shared TypeScript database types in `src/types/database.ts`.

### Acceptance Criteria
- Schema relationships match `SRS.md` §8 and `TECH-STACK.md` (Supabase Auth linkage).
- Every doctor belongs to exactly one clinic and one primary specialty.
- Database constraints reject overlapping active bookings for the same doctor and enforce unique reference/QR tokens.
- Migrations apply cleanly and fictional demo seed data populates clinics, specialties, doctors, schedules, exceptions, and sample bookings.

---

## Phase 3 — Application Foundation

### Tasks
- Configure root layout (`lang="ar"`, `dir="rtl"`) with clear Arabic typography (e.g., Cairo/Tajawal via `next/font/google`) and mobile-first responsive defaults.
- Establish consistent colors, spacing, border radii, and design tokens following `docs/UI_UX.md`.
- Build shared patient and dashboard layout shells in `src/components/layout/`.
- Build reusable UI primitives (`src/components/ui/`) for buttons, inputs, cards, dialogs, status badges, and navigation.
- Implement accessible status presentation (icon/text labels, never color alone).
- Create reusable loading, empty, error, and success state components in natural Egyptian colloquial Arabic (**عامية مصرية**).

### Acceptance Criteria
- RTL layout renders properly across mobile and desktop viewports.
- Typography, contrast, and touch targets are legible and comfortable on small screens.
- Shared components and states are reusable without duplication.
- Copy and design strictly follow `docs/UI_UX.md`.

---

## Phase 4 — Public Doctor Discovery

### Tasks
- Build data-access/service functions in `src/services/doctors.ts` and `src/services/clinics.ts` plus public API Route Handlers (`GET /api/specialties`, `GET /api/doctors?specialtyId=...`, `GET /api/doctors/:id`).
- Build the homepage (`src/app/(patient)/page.tsx`) with main heading `عايز تكشف عند دكتور إيه؟` and two prominent actions: `احجز عند دكتور` and `عندي حجز بالفعل`.
- Build medical specialties selection page (`اختار التخصص`) with clear names and recognizable icons.
- Build doctor listing by specialty showing required card fields (photo, full name, specialty, short bio, clinic name, clinic address, consultation fee, booking button; without cluttering cards with full schedules).
- Build doctor profile pages displaying full details, qualifications/experience (when available), clinic info, consultation fee, working schedule summary, and entry point to available slots.

### Acceptance Criteria
- Patient can navigate from homepage → specialties → doctors → doctor profile cleanly on mobile and desktop.
- Doctor cards and profiles display all required fields from `SRS.md` §4.3–§4.4.
- Deactivated doctors (and doctors in deactivated clinics) are excluded from public listings and profiles.

---

## Phase 5 — Scheduling and Availability

### Tasks
- Implement server-side availability calculation engine in `src/services/availability.ts`.
- Support weekly recurring schedules (`weekly_schedules`).
- Support manually added one-off dates/periods (`manual_availability`).
- Support schedule exceptions (`schedule_exceptions`) with strict precedence: exceptions override the weekly schedule for that date; manual availability adds extra working periods.
- Generate time slots based on working windows, `slot_duration_minutes`, and Egypt local time (`Africa/Cairo`), excluding past slots and slots overlapping active bookings.
- Classify calendar dates into `AVAILABLE`, `FULL`, and `OFF`.
- Expose server API endpoints (`GET /api/doctors/:id/available-dates?month=...`, `GET /api/doctors/:id/availability?date=...`).

### Acceptance Criteria
- Backend is the sole source of truth for dates and slots.
- Calendar dates accurately distinguish `AVAILABLE`, `FULL`, and `OFF`.
- Schedule exceptions override weekly schedules for the affected date, and manual availability adds extra bookable periods.
- Fully booked dates and inactive doctors/clinics expose no bookable slots.
- Cancelled bookings immediately restore slot availability.

---

## Phase 6 — Appointment Booking

### Tasks
- Build the patient booking UI (`src/app/(patient)/booking/` and `src/components/booking/`): select available date → select time slot (`المواعيد المتاحة`) → enter full name and phone number → confirm (`أكّد الحجز`).
- Validate requests server-side with Zod (`src/lib/validations/`).
- Implement transactional booking creation in `src/services/appointments.ts` and `POST /api/appointments` calling the transactional DB logic.
- Reject bookings for inactive doctors/clinics, unavailable dates, or overlapping/already-booked slots; on concurrent conflict, fail gracefully and return updated availability.
- Generate unique, non-reusable booking reference numbers (e.g., `DR-8K29P4`) and cryptographically random, non-guessable `qr_token` values; create bookings immediately with status `CONFIRMED`.
- Generate QR codes encoding `qr_token` using `qrcode`.
- Build the confirmation screen displaying reference number (`رقم الحجز`), QR code, patient name, doctor name, specialty, clinic name, clinic address (`عنوان العيادة`), date, and time, with guidance to save or screenshot it.

### Acceptance Criteria
- Patient can complete a booking without creating an account.
- Successful booking reserves exactly one slot and returns status `CONFIRMED`.
- Concurrent booking attempts for the same slot succeed for only one patient; the second receives a clear Egyptian Arabic message and refreshed availability.
- Confirmation displays all required details and a scannable QR code.
- Deactivated doctors cannot receive new bookings via UI or API.

---

## Phase 7 — Booking Management

### Tasks
- Build the existing-booking management flow (`src/app/(patient)/my-booking/`, entry `عندي حجز بالفعل`).
- Implement lookup endpoints (`GET /api/appointments/lookup?reference=...` and `GET /api/appointments/lookup?phone=...`).
- Display all matching bookings cleanly when a phone number has multiple appointments so the patient can pick the intended one.
- Display booking details with clear Egyptian Arabic actions: `غيّر معادك` and `إلغاء الحجز`.
- Implement transactional rescheduling (`PATCH /api/appointments/:id/reschedule`): atomically update the existing booking (release old slot, reserve new slot, no duplicate record, reject inactive doctors or conflicting slots).
- Implement cancellation (`PATCH /api/appointments/:id/cancel`) with confirmation prompt `متأكد إنك عايز تلغي الحجز؟`, setting status to `CANCELLED` and freeing the slot immediately.

### Acceptance Criteria
- Patients can look up appointments by either reference number or phone number (showing all matches for a phone number).
- Rescheduling updates the existing booking atomically: old slot becomes available, new slot becomes unavailable, and no duplicate booking is created.
- Cancellation marks status `CANCELLED` and immediately releases the slot.
- Cancelled (and completed/past) appointments cannot be checked in or rescheduled improperly.

---

## Phase 8 — Authentication and Authorization

### Tasks
- Configure Supabase Auth (email + password only; public signup disabled) for Owner and Receptionist accounts.
- Provision demo Owner and per-clinic Receptionist accounts linked to `admin_profiles` (`SRS.md` §12).
- Build the login page (`src/app/(auth)/login`) and server-side auth/session handling (`POST /api/admin/login`, logout endpoint/action that invalidates sessions).
- Implement basic login rate limiting (`SRS.md` §7.3).
- Protect `/owner/*`, `/receptionist/*`, and all `/api/owner/*` and `/api/receptionist/*` routes with server-side authentication and role checks (middleware + server guard helpers + DB RLS).
- Enforce strict Owner vs. Receptionist RBAC and single-clinic isolation for receptionists on every server endpoint.

### Acceptance Criteria
- Owner can sign in and access `/owner` routes and APIs.
- Receptionist can sign in and access only their assigned clinic's `/receptionist` routes and APIs.
- Receptionist receives `403`/redirect when attempting Owner endpoints or accessing another clinic's bookings.
- Unauthenticated requests to dashboards and admin APIs are rejected server-side.
- Logout invalidates the session; repeated failed logins are rate-limited.

---

## Phase 9 — Owner Dashboard

### Tasks
- Build the RTL Arabic Owner dashboard (`src/app/owner/`) and server-side API Route Handlers (`/api/owner/*`).
- Build dashboard overview (summary of clinics, doctors, today's/upcoming appointments).
- Implement Clinic management (add, edit, activate/deactivate clinic, manage name, address, phone).
- Implement Specialty management (add, edit, activate/deactivate specialties).
- Implement Doctor management (add, edit, upload doctor photo to Supabase Storage, assign 1 clinic & 1 primary specialty, set bio, qualifications, experience, consultation fee, slot duration, activate/deactivate doctor).
- Implement Schedule management per doctor: weekly fixed schedule, manual availability dates/hours, and schedule exceptions (closed days or modified/extra hours).
- Implement Receptionist account management (create receptionist accounts via Supabase Auth Admin API server-side, assign to 1 clinic, activate/deactivate).
- Implement platform-wide appointments view with clinic/date/status filters (including historical appointments for deactivated doctors).

### Acceptance Criteria
- Owner can manage specialties, clinics, doctors (including photo upload), schedules, exceptions, manual availability, and receptionists entirely through the UI.
- Changes reflect immediately on the public booking website.
- Deactivating a doctor prevents new bookings while keeping historical appointments visible in staff dashboards.
- Owner can view appointments across all clinics.

---

## Phase 10 — Receptionist Dashboard

### Tasks
- Build the RTL Arabic Receptionist dashboard (`src/app/receptionist/`) and server-side endpoints (`GET /api/receptionist/appointments`, `GET /api/receptionist/appointments/:reference`, `POST /api/receptionist/appointments/:reference/check-in`, plus QR token lookup/status updates).
- Display today's appointments (`Africa/Cairo`) and filterable/searchable clinic appointments strictly scoped to the receptionist's assigned clinic.
- Support search by booking reference number.
- Implement camera QR code scanning (resolving `qr_token`, with a lightweight scanner or native `BarcodeDetector` + manual reference fallback).
- Display patient name, phone number, doctor, appointment date/time, and status.
- Implement patient check-in action (`تسجيل وصول المريض`) transitioning `CONFIRMED` → `CHECKED_IN`, and support marking `COMPLETED` / `NO_SHOW` as appropriate while blocking check-in of `CANCELLED` bookings server-side and in UI.

### Acceptance Criteria
- Receptionist only sees and can query appointments for their assigned clinic.
- Lookup by reference number and QR scan accurately retrieve the booking.
- Clicking `تسجيل وصول المريض` updates status to `CHECKED_IN`.
- Attempting to check in a `CANCELLED` appointment (or another clinic's booking) fails cleanly on both UI and backend.

---

## Phase 11 — Testing and Quality Assurance

### Tasks
- Verify all 10 acceptance scenarios in `SRS.md` §10 end-to-end:
  1. Successful guest booking + unique reference & QR
  2. Concurrent double-booking prevention
  3. Phone number lookup (multiple bookings)
  4. Reference number lookup
  5. Atomic rescheduling (old slot freed, new slot reserved)
  6. Cancellation (`CANCELLED` + slot freed)
  7. Receptionist check-in (`CHECKED_IN`, blocked on `CANCELLED`)
  8. Clinic isolation between receptionists
  9. Schedule exceptions overriding weekly schedules (plus manual availability)
  10. Deactivated doctor blocked from new bookings while historical appointments remain accessible
- Test Egypt timezone (`Africa/Cairo`) boundary cases and past-slot exclusion.
- Test responsive layouts (360px–430px mobile + desktop), Arabic RTL alignment, Egyptian Arabic copy, and accessibility (contrast, touch targets, non-color status cues).
- Fix all identified bugs and re-verify.

### Acceptance Criteria
- All 10 `SRS.md` §10 acceptance scenarios pass without workarounds.
- No critical booking, concurrency, schedule, or RBAC/isolation bugs remain.
- All core flows work smoothly on mobile and desktop in RTL Egyptian Arabic.

---

## Phase 12 — Final MVP Preparation

### Tasks
- Perform security review (verify `SUPABASE_SERVICE_ROLE_KEY` never reaches client bundles, RLS policies, server-side RBAC, input validation, rate limiting, session invalidation).
- Review error handling and ensure all user-facing messages are clear Egyptian Arabic.
- Verify environment configuration (`.env.example`, required env vars).
- Verify demo dataset completeness and ensure all demo records are clearly marked as fictional (`SRS.md` §12).
- Verify clean production build (`npm run lint`, `npm run typecheck`, `npm run build`).
- Prepare deployment configuration and write `README.md` with setup, environment, migration/seed, and deployment instructions.

### Acceptance Criteria
- Production build succeeds cleanly with zero TypeScript or ESLint errors.
- No secrets are exposed in client-side code or committed to git.
- Demo data is complete and clearly marked fictional.
- `README.md` documents local setup, Supabase setup, and deployment clearly.

---

## 2. Out of Scope

Do not implement these features in this MVP:

- Patient registration, accounts, or login.
- OTP or phone verification.
- Online payments.
- Medical records or patient medical history.
- Prescriptions.
- Video consultations / telemedicine.
- Insurance integrations.
- SMS, WhatsApp, or complex notification systems.
- Multi-city or multi-region selection.
- Doctor accounts or doctor dashboards.
- Multi-clinic assignment for a single doctor.
- Separate backend applications (NestJS/Express), Redis, microservices, or Prisma (unless a concrete need arises).

---

## 3. Execution Policy

Work on one phase at a time.

For every phase:

1. Inspect existing project files.
2. Review the relevant requirements.
3. Explain the planned changes briefly.
4. Implement the phase.
5. Run relevant tests and checks.
6. Fix failures.
7. Report completed work and remaining issues.
8. Update this implementation plan (`Phase Tracker`).

Do not mark a phase complete if its acceptance criteria have not been verified.

The next phase may begin only after the current phase is completed and verified.
