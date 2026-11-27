# حجز دكتور — Doctor Appointment Booking Platform (MVP)

Mobile-first, right-to-left (`dir="rtl"`) doctor appointment booking web platform in simple Egyptian colloquial Arabic (**عامية مصرية**) designed for local medical clinics in Beheira, Egypt.

## Overview & Roles

- **Guest Patient (`/`, `/specialties`, `/doctors`, `/booking`, `/my-booking`):** No account or login required. Browse medical specialties and active doctors, pick available dates and time slots calculated in Egypt time (`Africa/Cairo`), confirm bookings immediately (`CONFIRMED`) with a unique booking reference (`DR-XXXXXX`) and scannable QR code, look up existing bookings by reference or phone number (showing multiple matches), reschedule atomically, or cancel appointments.
- **Clinic Receptionist (`/receptionist`, `/receptionist/appointments`, `/receptionist/check-in`):** Email/password staff login strictly scoped to **one assigned clinic**. View today's (`Africa/Cairo`) and historical clinic appointments, scan patient QR codes (`BarcodeDetector` camera scan or manual reference fallback), verify patient/doctor/clinic details, check in `CONFIRMED` appointments (`تسجيل وصول المريض` → `CHECKED_IN`), and update `COMPLETED` / `NO_SHOW` statuses. Check-in is blocked for `CANCELLED` bookings.
- **Website Owner (`/owner`, `/owner/clinics`, `/owner/specialties`, `/owner/doctors`, `/owner/doctors/[id]/schedule`, `/owner/receptionists`, `/owner/appointments`):** Platform-wide management of clinics, medical specialties, doctors (1 clinic and 1 primary specialty per doctor, plus photo upload to Supabase Storage), doctor schedules (`weekly_schedules`, additive `manual_availability`, and overriding `schedule_exceptions`), per-clinic receptionist accounts, and platform-wide appointment oversight (including historical appointments of deactivated doctors).

### Explicitly Out of Scope (MVP Boundaries)
Patient accounts/registration/login, OTP verification, online payments, medical records/history, prescriptions, video consultations/telemedicine, insurance integrations, SMS/WhatsApp notifications, multi-city/region selection, doctor accounts/dashboards, and multi-clinic assignment for one doctor.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack, `cacheComponents: true`, `partialPrefetching: true`) + React 19 + TypeScript
- **Styling & UI:** Tailwind CSS v4, `shadcn/ui` (`@base-ui/react`), `lucide-react`
- **Database, Auth & Storage:** Supabase (PostgreSQL, `@supabase/supabase-js`, `@supabase/ssr`, SQL migrations in [`supabase/migrations/`](supabase/migrations))
- **Validation, Forms, Dates & QR:** `zod` v4, `react-hook-form`, `@hookform/resolvers`, `date-fns`, `qrcode`

See [`SRS.md`](SRS.md), [`docs/TECH_STACK.md`](docs/TECH_STACK.md), [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md), [`docs/UI_UX.md`](docs/UI_UX.md), and [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) for the full specifications.

---

## Prerequisites & Local Setup

### Requirements
- **Node.js 20+** and **npm**
- A hosted or local **Supabase** project

### 1. Install Dependencies & Configure Environment Variables

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:

| Variable | Visibility | Required | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (browser + server) | Yes | Your Supabase project URL (`https://<project-ref>.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public (browser + server) | Yes | Supabase publishable/anon key (fallback to `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also supported). |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only (SECRET)** | Yes | Supabase service role key used exclusively in server code (`src/lib/supabase/admin.ts`) for booking RPCs, staff dashboards, doctor photo uploads, and staff provisioning. **Never** prefix with `NEXT_PUBLIC_` or commit to git. |
| `DEMO_STAFF_PASSWORD` | Local/Demo CLI only | No | Optional password override for `scripts/seed-demo-staff.ts` (defaults to `DemoStaff!2026`). |

> Keep `.env.local` out of git (`.gitignore` ignores `.env` and `.env.*` while preserving `.env.example`).

---

## Supabase Setup (Migrations, Storage, Auth & Fictional Demo Seed)

### 1. Apply SQL Migrations

Apply every migration in [`supabase/migrations/`](supabase/migrations) in chronological order (via Supabase CLI `supabase db push` or the Supabase SQL Editor):

1. `0001_catalog_tables.sql` — `clinics`, `specialties`, `doctors`, and update triggers
2. `0002_scheduling_tables.sql` — `weekly_schedules`, `manual_availability`, `schedule_exceptions`
3. `0003_appointments.sql` — `appointments` table, indexes, and `btree_gist` exclusion constraint (`appointments_no_active_overlap`) preventing active slot double-booking in `Africa/Cairo`
4. `0004_admin_profiles_rls.sql` — `admin_profiles` linked to `auth.users(id)` and baseline Row Level Security (RLS) policies
5. `0005_booking_rpcs.sql` — initial transactional booking RPC definitions
6. `0006_doctor_photos_storage.sql` — public `doctor-photos` Supabase Storage bucket (JPEG/PNG/WebP, 5 MB limit)
7. `0007_harden_booking_rpcs.sql` — hardened `is_slot_available`, `create_appointment`, `reschedule_appointment`, and `cancel_appointment` (`SECURITY DEFINER`, executed exclusively by `service_role`)

### 2. Configure Supabase Auth

- Open **Authentication → Sign In / Providers → Email** in your Supabase project.
- Keep Email/Password enabled and **disable public user signups** (`Allow new users to sign up` = off). Staff accounts are created exclusively via Supabase Auth Admin APIs or the Owner dashboard.

### 3. Load Fictional Demo Data (Optional — Non-Production Only)

> **Important:** All records in [`supabase/seed.sql`](supabase/seed.sql) and [`scripts/seed-demo-staff.ts`](scripts/seed-demo-staff.ts) are strictly **fictional demo data** (using placeholder Arabic names, Beheira clinic addresses, and RFC 2606 `.example` emails). **Do not run demo seeding on a live production database with real users.**

1. Run [`supabase/seed.sql`](supabase/seed.sql) in your Supabase SQL Editor (or via `psql`) to populate 3 fictional clinics, 6 specialties, 7 doctors (6 active + 1 inactive test doctor), weekly schedules, manual availability, schedule exceptions (`CLOSED`, `MODIFIED_HOURS`, `EXTRA_HOURS`), and sample bookings across every status (`CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `CANCELLED`, `NO_SHOW`).
2. Provision the fictional demo Owner and per-clinic Receptionist Auth accounts:

```bash
npx tsx --env-file=.env.local scripts/seed-demo-staff.ts
```

This idempotently creates/updates the demo staff accounts (password: `DEMO_STAFF_PASSWORD` or default `DemoStaff!2026`):

| Role | Email | Clinic Scope |
|---|---|---|
| `OWNER` | `owner@beheira-demo.example` | All clinics |
| `RECEPTIONIST` | `nile.reception@beheira-demo.example` | عيادة النيل (`11000000-0000-0000-0000-000000000001`) |
| `RECEPTIONIST` | `beach.reception@beheira-demo.example` | عيادة الشاطئ (`11000000-0000-0000-0000-000000000002`) |
| `RECEPTIONIST` | `station.reception@beheira-demo.example` | عيادة المحطة (`11000000-0000-0000-0000-000000000003`) |

Useful fictional bookings seeded for patient lookup demos (`/my-booking`):
- Phone with multiple upcoming confirmed bookings: `01020000001`
- Sample reference numbers: `DR-A1B2C3` (confirmed), `DR-B2C3D4` (confirmed), `DR-C3D4E5` (checked in), `DR-E5F6G7` (cancelled), `DR-H8J9K0` (historical booking on inactive demo doctor)

---

## Development & Verification Scripts

```bash
npm run dev        # Start Next.js dev server at http://localhost:3000
npm test           # Run all unit, integration, SRS §10 acceptance, timezone, RTL, and security audit tests (tsx --test)
npm run typecheck  # Generate Next.js route types and run tsc --noEmit
npm run lint       # Run ESLint across the repository
npm run build      # Create production build (Turbopack)
npm run start      # Start production server after npm run build
```

---

## Deployment (Vercel + Hosted Supabase)

1. Push the repository to GitHub (or connect your repo directly in Vercel).
2. Create a Vercel project with the default Next.js preset (`npm run build` / Node.js 20+).
3. Configure **Environment Variables** in Vercel for Production and Preview environments:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (keep strictly server-side; **never** expose with `NEXT_PUBLIC_`)
4. Apply all SQL migrations (`0001`–`0007`) to the target Supabase project and ensure public signups are disabled in Supabase Auth.
5. For a **demo/staging** deployment, run `supabase/seed.sql` and `scripts/seed-demo-staff.ts` against that staging Supabase project. For **live clinics**, create the initial `OWNER` Auth user + `admin_profiles` row manually in Supabase and provision real clinics, doctors, and clinic receptionists from `/owner`.
6. After deployment, smoke-test:
   - Guest patient booking on `/specialties` → `/booking` + confirmation QR display
   - Booking lookup, reschedule, and cancellation on `/my-booking`
   - Staff login at `/login`, clinic-isolated check-in at `/receptionist/check-in`, and owner management at `/owner`

---

## Security & Architecture Highlights

- **Server-only service role isolation:** `SUPABASE_SERVICE_ROLE_KEY` and `createAdminClient()` ([`src/lib/supabase/admin.ts`](src/lib/supabase/admin.ts)) stay strictly on the server (guarded at runtime and verified against client source files and static bundles).
- **Database double-booking protection:** `appointments_no_active_overlap` (`btree_gist`) + `create_appointment` / `reschedule_appointment` / `cancel_appointment` RPCs enforce atomic slot allocation in `Africa/Cairo`, returning `409 SLOT_UNAVAILABLE` with refreshed availability on concurrent conflicts.
- **RBAC & strict clinic isolation:** [`src/proxy.ts`](src/proxy.ts), server guards in [`src/lib/auth/guards.ts`](src/lib/auth/guards.ts), route handlers, and PostgreSQL RLS policies enforce Owner vs. Receptionist roles and restrict each receptionist strictly to their assigned clinic.
- **Auth hardening & HTTP headers:** Sliding-window login rate limiting (`src/lib/auth/rate-limit.ts`), global session invalidation on logout, `Cache-Control: no-store` on dynamic patient/staff API responses, `poweredByHeader: false`, and `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` (`camera=(self)`) headers in [`next.config.ts`](next.config.ts).
