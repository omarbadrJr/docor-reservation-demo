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
- **App:** Single Next.js 16 (App Router, Turbopack, `cacheComponents: true`, `partialPrefetching: true`) + React 19 + TypeScript application serving patient pages, owner dashboard, receptionist dashboard, and server-side API Route Handlers.
- **UI:** Tailwind CSS v4, `shadcn/ui` (`@base-ui/react`), `lucide-react`.
- **Backend & DB:** Supabase (PostgreSQL + `@supabase/supabase-js` + `@supabase/ssr` + version-controlled SQL migrations in `supabase/migrations/`).
- **Auth:** Supabase Auth (email + password) for Owner and Receptionist only; no public registration. Link `admin_profiles` (`role`, `clinic_id`, `is_active`) to `auth.users(id)` rather than storing separate custom password hashes.
- **Libraries:** `zod` (v4), `react-hook-form`, `@hookform/resolvers`, `date-fns`, `qrcode`.
- **Avoid:** Separate backend servers (NestJS/Express), Prisma (unless a concrete need arises), Redis, microservices, and unnecessary dependencies.

## 4. Architecture & Folder Rules
Follow `docs/PROJECT_STRUCTURE.md` incrementally — create folders and files only when needed (no speculative abstractions):
- `src/app/` — Route groups `(patient)/` (`page.tsx`, `specialties/`, `doctors/`, `doctors/[id]/`, `booking/`, `my-booking/`), `(auth)/login`, `owner/`, `receptionist/`, server-side `api/` Route Handlers (`api/specialties`, `api/doctors`, `api/doctors/[id]`, `api/doctors/[id]/available-dates`, `api/doctors/[id]/availability`, `api/appointments`, `api/appointments/lookup`, `api/appointments/[id]/reschedule`, `api/appointments/[id]/cancel`, `api/admin/login`, `api/admin/logout`, `api/owner/me`, `api/receptionist/me`), and `src/proxy.ts` (Next.js 16 auth proxy). Keep page components thin (UI rendering and coordination only; no complex business logic). With `cacheComponents: true`, wrap dynamic server reads in `<Suspense>` boundaries so prerendering succeeds cleanly.
- `src/components/` — Reusable UI (`ui/`, `layout/`, `auth/`, `doctors/`, `booking/`, `dashboard/`). Do not duplicate components across pages.
- `src/services/` — Core business logic (`appointments.ts`, `auth.ts`, `availability.ts`, `doctors.ts`, `clinics.ts`, `specialties.ts`).
- `src/lib/` — Shared utilities (`availability.ts`, `cairo-time.ts`, `format.ts`, `qr.ts`, `schedule.ts`, `utils.ts`), auth helpers (`lib/auth/`: `guards.ts`, `proxy.ts`, `rate-limit.ts`), Supabase clients (`lib/supabase/`: `client.ts` browser, `server.ts` SSR/cookie, `anon.ts` public read-only, `admin.ts` server-only service-role), and Zod schemas (`lib/validations/` including `auth.ts`).
- `src/types/` — Shared TypeScript types (`database.ts`, `auth.ts`, `catalog.ts`, `availability.ts`, `booking.ts`).
- `supabase/` — SQL migrations (`migrations/0001`–`0007`: catalog, scheduling, appointments + `btree_gist` exclusion, `admin_profiles` + RLS, transactional booking RPCs, doctor photos storage, hardened booking RPCs) and fictional demo seed data (`seed.sql`).

## 5. Non-Negotiable Domain & Security Invariants
- **Backend as availability source of truth:** Never rely on the frontend to compute or enforce slot availability. Calendar day states are `AVAILABLE`, `FULL`, and `OFF`.
- **Cairo timezone & time contract:** Compute all dates, working windows, and slots in `Africa/Cairo` local time via `src/lib/cairo-time.ts`. Store and transfer times as `HH:MM(:SS)` in the database and API; format for display only in the UI.
- **Transactional double-booking prevention:** Prevent overlapping bookings for the same doctor in both server logic and PostgreSQL transactions/constraints (`btree_gist` exclusion + booking RPCs). Concurrent conflicts must fail gracefully (`409`) and return updated availability.
- **Atomic rescheduling & cancellation:**
  - Rescheduling updates the existing booking transactionally (releases the old slot, reserves the new slot, no duplicate booking).
  - Cancellation sets status to `CANCELLED` and immediately frees the slot.
- **Booking statuses:** `CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `CANCELLED`, `NO_SHOW`. Bookings become `CONFIRMED` immediately upon creation (no receptionist approval step).
- **References & QR tokens:** Every booking gets a unique, non-reusable reference (e.g. `DR-8K29P4`) and a secure, non-guessable `qr_token`.
- **Patient lookup:** Support lookup by booking reference or phone number; if a phone number has multiple bookings, display all matching bookings.
- **Schedule precedence:** `ScheduleException` overrides `WeeklySchedule` on the affected date; `ManualAvailability` adds extra/one-time working periods.
- **Inactive doctors:** Deactivated doctors (or doctors in deactivated clinics) cannot receive new patient bookings, but historical appointments remain accessible to authorized staff.
- **Server-side RBAC & clinic isolation:** Enforce Owner vs. Receptionist authorization on the backend (and DB policies), never only in UI. Receptionists can only view/manage their assigned clinic's appointments and cannot check in a `CANCELLED` booking.
- **Secrets & sessions:** Never expose `SUPABASE_SERVICE_ROLE_KEY` or import `createAdminClient()` (`src/lib/supabase/admin.ts`) in client/browser code; use environment variables; apply basic login rate limiting and invalidate sessions on logout.

## 6. UI/UX & Arabic Copy Guidelines
- **Language & direction:** Natural Egyptian colloquial Arabic (**عامية مصرية**) with RTL (`dir="rtl"`) across both patient-facing pages and admin dashboards. Avoid stiff formal Arabic and literal English translations.
- **Time & date display:** Use `formatArabicTime` / `formatWorkingSchedule` (`src/lib/schedule.ts`) for 12-hour Arabic times (`الصبح` for `00:00`–`11:59`, `مساءً` for `12:00`–`23:59`, e.g., `9:00 الصبح - 5:00 مساءً`), and `formatArabicDate` / `formatArabicMonth` (`src/lib/format.ts`) for deterministic Arabic dates with ASCII digits.
- **Required/canonical labels:**
  - Homepage heading: `عايز تكشف عند دكتور إيه؟`
  - Primary actions: `احجز عند دكتور` and `عندي حجز بالفعل`
  - Booking & management labels: `اختار التخصص`, `المواعيد المتاحة`, `أكّد الحجز`, `رقم الحجز`, `عنوان العيادة`, `غيّر معادك`, `إلغاء الحجز`, `متأكد إنك عايز تلغي الحجز؟`
  - Receptionist check-in: `تسجيل وصول المريض`
- **Usability:** Mobile-first, uncluttered, large readable text, large touch-friendly buttons, minimal steps, accessible contrast, never rely on color alone to convey status, and clear loading/empty/success/error states. Do not invent extra booking steps or unnecessary dialogs.

## 7. Implementation & Verification Workflow
- Follow the phase-by-phase plan in `IMPLEMENTATION-PLAN.md` (aligned with `SRS.md` §11), checking its Phase Tracker for current progress (Phases 1–8 completed; Phases 9–12 remaining) and verifying each phase's acceptance criteria plus all 10 acceptance criteria in `SRS.md` §10 before advancing.
- Keep all seed/demo records clearly marked as fictional (`SRS.md` §12).
- Keep edits focused and minimal; avoid touching unrelated files.
- **Branching workflow:** Use feature/fix branches (`feat/...`, `fix/...`) merged into `dev` via PR, and merge `dev` into `main` via PR (unless the user explicitly asks to push directly to `dev`).
- **Commands** (run `test`, `typecheck`, `lint`, and `build` before finishing code changes):
  - `npm run dev` — start the local dev server (http://localhost:3000).
  - `npm test` — `tsx --test` for service, validation, and component tests.
  - `npm run typecheck` — `next typegen && tsc --noEmit` (route types such as `LayoutProps` are generated first).
  - `npm run lint` — ESLint.
  - `npm run build` — production build (Turbopack).
- **Environment:** Copy `.env.example` to `.env.local`. Never commit `.env.local` or secrets. `SUPABASE_SERVICE_ROLE_KEY` is server-only.

## 8. Agent Boundaries
- **No GitHub writes without explicit permission:** Never commit, push, create/update/pull-request, merge, or publish any change to GitHub unless the user explicitly asks for that exact action in the current request. Do all work and verification locally and leave Git/GitHub actions for the user to authorize.
- **Always commit `AGENTS.md` to GitHub:** Never exclude `AGENTS.md` as a local-only modification — whenever `AGENTS.md` is updated or when committing/pushing authorized changes, always include and commit `AGENTS.md` to GitHub.
- **Only do what was asked:** Implement only the feature, task, or fix the user explicitly requested. Do not start adjacent or future features, phase work, refactors, or opportunistic cleanup. The phased roadmap is context, not automatic permission to continue. If related work is needed, report it and wait for direction.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
