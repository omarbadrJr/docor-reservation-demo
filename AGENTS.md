# AGENTS.md

Operational guide for coding agents working in this repository.

## 1. Project Overview & Source-of-Truth Docs
Mobile-first, RTL web platform in simple Egyptian colloquial Arabic (**عامية مصرية**) for booking doctor appointments in one local area in Beheira, Egypt, designed for users with limited technical experience.

Read the relevant specification before implementing changes:
- `SRS.md` — Full MVP requirements, roles, workflows, data model proposal, API proposal, acceptance criteria (§10), implementation order (§11), and demo dataset (§12).
- `docs/TECH_STACK.md` — Approved stack, Supabase usage, and explicit technologies to avoid.
- `docs/PROJECT_STRUCTURE.md` — Target Next.js + Supabase directory layout and layering rules.
- `docs/UI_UX.md` — Egyptian Arabic copy, RTL layout, and accessibility guidelines.
- `IMPLEMENTATION-PLAN.md` — Phased execution roadmap, per-phase acceptance criteria, and completion tracker.

## 2. User Roles & Scope Boundaries
Three roles exist:
- **Patient (guest, no account):** Browse specialties and doctors, book appointments, receive a unique booking reference + QR code, look up bookings by reference or phone number, reschedule, and cancel.
- **Clinic Receptionist (authenticated, 1 assigned clinic):** View/search their clinic's appointments, scan QR codes or look up by reference, verify details, and check patients in.
- **Website Owner (authenticated, platform-wide):** Manage specialties, clinics, doctors (1 clinic and 1 primary specialty per doctor), receptionist accounts, weekly schedules, manual availability, schedule exceptions, and view appointments across all clinics.

**Strictly out of scope for MVP — do not add:**
Patient accounts/registration/login, OTP verification, online payments, medical records/history, video consultations, prescriptions, insurance integrations, SMS/WhatsApp notifications, multi-city/multi-region selection, doctor accounts/dashboards, or multi-clinic assignment for one doctor.

## 3. Tech Stack & Constraints
- **App:** Single Next.js (App Router) + React + TypeScript application serving patient pages, owner dashboard, receptionist dashboard, and server-side API Route Handlers.
- **UI:** Tailwind CSS, `shadcn/ui`, `lucide-react`.
- **Backend & DB:** Supabase (PostgreSQL + Supabase JS + version-controlled SQL migrations in `supabase/`).
- **Auth:** Supabase Auth (email + password) for Owner and Receptionist only; no public registration. Link admin role/clinic metadata (e.g., `admin_users` / `admin_profiles`) to `auth.users(id)` rather than storing separate custom password hashes.
- **Libraries:** `zod`, `react-hook-form`, `date-fns`, `qrcode`.
- **Avoid:** Separate backend servers (NestJS/Express), Prisma (unless a concrete need arises), Redis, microservices, and unnecessary dependencies.

## 4. Architecture & Folder Rules
Follow `PROJECT-STRUCTURE.md` incrementally — create folders and files only when needed (no speculative abstractions):
- `src/app/` — Route groups `(patient)/`, `(auth)/login`, `owner/`, `receptionist/`, and server-side `api/` Route Handlers. Keep page components thin (UI rendering and coordination only; no complex business logic).
- `src/components/` — Reusable UI (`ui/`, `layout/`, `doctors/`, `booking/`, `dashboard/`). Do not duplicate components across pages.
- `src/services/` — Core business logic (`appointments.ts`, `availability.ts`, `doctors.ts`, `clinics.ts`).
- `src/lib/` — Shared utilities, Supabase clients (`lib/supabase/`), and Zod schemas (`lib/validations/`).
- `src/types/` — Shared TypeScript/database types (`database.ts`).
- `supabase/` — SQL migrations (`migrations/`) and fictional demo seed data (`seed.sql`).

## 5. Non-Negotiable Domain & Security Invariants
- **Backend as availability source of truth:** Never rely on the frontend to compute or enforce slot availability. Calendar day states are `AVAILABLE`, `FULL`, and `OFF`.
- **Transactional double-booking prevention:** Prevent overlapping bookings for the same doctor in both server logic and PostgreSQL transactions/constraints. Concurrent conflicts must fail gracefully and return updated availability.
- **Atomic rescheduling & cancellation:**
  - Rescheduling updates the existing booking transactionally (releases the old slot, reserves the new slot, no duplicate booking).
  - Cancellation sets status to `CANCELLED` and immediately frees the slot.
- **Booking statuses:** `CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `CANCELLED`, `NO_SHOW`. Bookings become `CONFIRMED` immediately upon creation (no receptionist approval step).
- **References & QR tokens:** Every booking gets a unique, non-reusable reference (e.g. `DR-8K29P4`) and a secure, non-guessable `qr_token`.
- **Patient lookup:** Support lookup by booking reference or phone number; if a phone number has multiple bookings, display all matching bookings.
- **Schedule precedence:** `ScheduleException` overrides `WeeklySchedule` on the affected date; `ManualAvailability` adds extra/one-time working periods.
- **Inactive doctors:** Deactivated doctors cannot receive new patient bookings, but historical appointments remain accessible to authorized staff.
- **Server-side RBAC & clinic isolation:** Enforce Owner vs. Receptionist authorization on the backend (and DB policies), never only in UI. Receptionists can only view/manage their assigned clinic's appointments and cannot check in a `CANCELLED` booking.
- **Secrets & sessions:** Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code; use environment variables; apply basic login rate limiting and invalidate sessions on logout.

## 6. UI/UX & Arabic Copy Guidelines
- **Language & direction:** Natural Egyptian colloquial Arabic (**عامية مصرية**) with RTL (`dir="rtl"`) across both patient-facing pages and admin dashboards. Avoid stiff formal Arabic and literal English translations.
- **Required/canonical labels:**
  - Homepage heading: `عايز تكشف عند دكتور إيه؟`
  - Primary actions: `احجز عند دكتور` and `عندي حجز بالفعل`
  - Booking & management labels: `اختار التخصص`, `المواعيد المتاحة`, `أكّد الحجز`, `رقم الحجز`, `عنوان العيادة`, `غيّر معادك`, `إلغاء الحجز`, `متأكد إنك عايز تلغي الحجز؟`
  - Receptionist check-in: `تسجيل وصول المريض`
- **Usability:** Mobile-first, uncluttered, large readable text, large touch-friendly buttons, minimal steps, accessible contrast, never rely on color alone to convey status, and clear loading/empty/success/error states. Do not invent extra booking steps or unnecessary dialogs.

## 7. Implementation & Verification Workflow
- Follow the phase-by-phase plan in `IMPLEMENTATION-PLAN.md` (aligned with `SRS.md` §11), verifying each phase's acceptance criteria and all 10 acceptance criteria in `SRS.md` §10 before advancing.
- Keep all seed/demo records clearly marked as fictional (`SRS.md` §12).
- Keep edits focused and minimal; avoid touching unrelated files.
- **Commands** (run `typecheck`, `lint`, and `build` before finishing changes):
  - `npm run dev` — start the local dev server (http://localhost:3000).
  - `npm run typecheck` — `next typegen && tsc --noEmit` (route types such as `LayoutProps` are generated first).
  - `npm run lint` — ESLint.
  - `npm run build` — production build (Turbopack).
  - `npm test` — `tsx --test` for service, validation, and component tests.
- **Environment:** Copy `.env.example` to `.env.local`. Never commit `.env.local` or secrets. `SUPABASE_SERVICE_ROLE_KEY` is server-only.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
