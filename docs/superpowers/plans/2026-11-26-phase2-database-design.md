# Phase 2 Database Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the Supabase schema, constraints, RPCs, policies, demo seed data, and shared TypeScript types for the doctor booking MVP.

**Architecture:** Numbered SQL migrations build the schema in dependency order (catalog → scheduling → appointments → admin/RLS → RPCs → storage). A single fictional `seed.sql` is applied after all migrations. TypeScript types mirror the SQL row shapes; no client code or API routes are added in this phase.

**Tech Stack:** PostgreSQL 15+ on Supabase, `pgcrypto`, `btree_gist`, Supabase Auth (`auth.users`), Supabase Storage, TypeScript.

**Spec:** `SRS.md` §8 and §12; `IMPLEMENTATION-PLAN.md` Phase 2; `AGENTS.md` §5; `docs/TECH_STACK.md`.

## Global Constraints

- One clinic and one primary specialty per doctor; both are required.
- Appointment statuses are exactly `CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `CANCELLED`, `NO_SHOW`.
- Only active (`CONFIRMED`, `CHECKED_IN`) bookings reserve a slot.
- `reference_number` and `qr_token` are unique, non-reusable, and generated server-side.
- Admin profiles link to `auth.users(id)`; no custom password hashes, no patient accounts.
- Receptionists are scoped to exactly one clinic; owners have `clinic_id = null`.
- Schedule exceptions override weekly schedules; manual availability adds extra windows.
- All demo records are clearly marked as fictional.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code; no secrets in git.
- Migrations must apply cleanly in filename order; no destructive changes to existing data.

## Review Focus

- Concurrent or sequential overlapping bookings for a doctor must be rejected while adjacent or cancelled bookings remain allowed — Task 3 asserts both cases against the exclusion constraint.
- Rescheduling must update the same row atomically and must not resurrect a cancelled/completed booking — Task 5 asserts the row id is unchanged and the old slot becomes free.
- A closed exception must block weekly slots while manual availability still adds bookable windows — Task 5 asserts `is_slot_available` for both cases.
- Deactivated doctors/clinics must reject new bookings but keep historical rows readable — Task 5 and Task 4 assert this.
- RLS must never let anonymous users read appointments or write catalog tables — Task 4 asserts the policy list and that only owner/receptionist policies exist.

---

### Task 1: Catalog tables migration

**Files:**
- Create: `supabase/migrations/0001_catalog_tables.sql`
- Modify: `IMPLEMENTATION-PLAN.md` (Phase 2 tracker → In Progress)

**Interfaces:**
- Produces: `public.clinics(id uuid)`, `public.specialties(id uuid)`, `public.doctors(id uuid, clinic_id uuid, specialty_id uuid, slot_duration_minutes int, consultation_fee numeric, is_active bool)`, plus `public.set_updated_at()` trigger function.

- [ ] **Step 1: Write the migration**

Enable `pgcrypto` and `btree_gist` in the `extensions` schema, add the `set_updated_at()` trigger helper, then create `clinics`, `specialties`, `doctors` with required fields, `is_active`, timestamps, CHECK constraints for non-empty names and positive fee/duration, foreign keys with `on delete restrict`, and indexes on `clinic_id`, `specialty_id`, `is_active`.

- [ ] **Step 2: Verify the migration applies and enforces its constraints**

Apply migrations 0001 in a local PGlite database with the `btree_gist`/`pgcrypto` contrib bundles loaded and `search_path = public, extensions`. Assert the three tables and their columns exist, a doctor with a missing clinic is rejected, and a zero slot duration is rejected.

- [ ] **Step 3: Commit**

`git add supabase/migrations/0001_catalog_tables.sql IMPLEMENTATION-PLAN.md && git commit -m "feat(db): add clinic, specialty, and doctor tables"`

### Task 2: Scheduling tables migration

**Files:**
- Create: `supabase/migrations/0002_scheduling_tables.sql`

**Interfaces:**
- Consumes: `public.doctors(id uuid)`
- Produces: `public.weekly_schedules`, `public.manual_availability`, `public.schedule_exceptions` with `exception_type` in `CLOSED`, `MODIFIED_HOURS`, `EXTRA_HOURS`.

- [ ] **Step 1: Write the migration**

Create the three scheduling tables with doctor foreign keys (`on delete cascade`), day/date/time fields, `end_time > start_time` checks, and a constraint that `CLOSED` exceptions have no times while the other types require them. Add indexes on `(doctor_id, day_of_week)` and `(doctor_id, date)`.

- [ ] **Step 2: Verify the migration applies and enforces precedence-ready shapes**

Apply 0001–0002 in PGlite. Assert `CLOSED` with times is rejected, `MODIFIED_HOURS` without times is rejected, and `end_time <= start_time` is rejected for all three tables.

- [ ] **Step 3: Commit**

`git add supabase/migrations/0002_scheduling_tables.sql && git commit -m "feat(db): add weekly, manual, and exception schedules"`

### Task 3: Appointments table and double-booking guard

**Files:**
- Create: `supabase/migrations/0003_appointments.sql`

**Interfaces:**
- Consumes: `public.doctors`, `public.clinics`, `btree_gist`
- Produces: `public.appointments(id, reference_number, qr_token, doctor_id, clinic_id, patient_name, patient_phone, appointment_date, start_time, end_time, status, created_at, updated_at)` and constraint `appointments_no_active_overlap`.

- [ ] **Step 1: Write the migration**

Create `appointments` with all SRS §8 fields, unique constraints on `reference_number` and `qr_token`, a status CHECK constraint, a reference format CHECK (`^DR-[A-Z0-9]{6}$`), and a partial GiST exclusion constraint on `(doctor_id, tstzrange((appointment_date + start_time) at time zone 'Africa/Cairo', (appointment_date + end_time) at time zone 'Africa/Cairo', '[)'))` for active statuses only. Add indexes on `(doctor_id, appointment_date, status)`, `(clinic_id, appointment_date)`, `patient_phone`, and `status`.

- [ ] **Step 2: Verify overlaps, adjacency, and cancelled slots**

Apply 0001–0003 in PGlite. Assert: an overlapping active booking is rejected, an adjacent booking at the exact end time is accepted, a cancelled booking does not block a new one, duplicate reference numbers are rejected, and an invalid status is rejected.

- [ ] **Step 3: Commit**

`git add supabase/migrations/0003_appointments.sql && git commit -m "feat(db): add appointments with overlap protection"`

### Task 4: Admin profiles and baseline RLS

**Files:**
- Create: `supabase/migrations/0004_admin_profiles_rls.sql`

**Interfaces:**
- Consumes: `auth.users(id)`, Supabase roles `anon`, `authenticated`, `service_role`
- Produces: `public.admin_profiles`, `public.current_admin_role()`, RLS policies on all eight tables.

- [ ] **Step 1: Write the migration**

Create `admin_profiles` with `id uuid primary key references auth.users(id) on delete cascade`, name, email, role CHECK (`OWNER`/`RECEPTIONIST`), nullable `clinic_id` with a CHECK that receptionists have one, `is_active`, timestamps. Add a `SECURITY DEFINER` function `current_admin_role()` returning the caller's active role. Enable RLS on all tables: public `SELECT` of active catalog rows only, no public writes; owner/receptionist `SELECT` on appointments scoped by clinic; admin profile `SELECT` for self or owner; no anon access to appointments or admin profiles. Leave writes to the server/service role except through RPCs.

- [ ] **Step 2: Verify policy surface**

Apply 0001–0004 in PGlite with stub `auth.users` and roles. Assert RLS is enabled on all eight tables, no policy grants `anon` write access, no policy grants `anon` read of appointments/admin profiles, and receptionist appointment policies reference `clinic_id`.

- [ ] **Step 3: Commit**

`git add supabase/migrations/0004_admin_profiles_rls.sql && git commit -m "feat(db): add admin profiles and baseline RLS"`

### Task 5: Transactional booking RPCs

**Files:**
- Create: `supabase/migrations/0005_booking_rpcs.sql`

**Interfaces:**
- Consumes: all tables above; `gen_random_bytes` from `pgcrypto`
- Produces: `public.is_slot_available(uuid, date, time, time) → boolean`, `public.create_appointment(uuid, date, time, text, text) → appointments`, `public.reschedule_appointment(uuid, date, time) → appointments`, `public.cancel_appointment(uuid) → appointments`.

- [ ] **Step 1: Write the migration**

Implement `is_slot_available` using the rule: `CLOSED`/`MODIFIED_HOURS`/`EXTRA_HOURS` exceptions replace weekly windows for that date, manual availability windows are always added, and the whole slot must fit inside one window. Implement `create_appointment` to validate active doctor/clinic, non-past start in `Africa/Cairo`, availability, input lengths, then insert with `CONFIRMED`, `DR-` + six hex characters, and a 24-byte hex QR token. Implement `reschedule_appointment` to update only the existing row from an active status and reject unavailable/conflicting slots. Implement `cancel_appointment` to set `CANCELLED` from an active status. All functions are `SECURITY DEFINER` with `set search_path = public, extensions, pg_temp`; revoke public execute and grant to `anon` and `authenticated`.

- [ ] **Step 2: Verify the transactional flows**

Apply 0001–0005 in PGlite with a fixed seed clinic/doctor/schedule. Assert: booking a valid slot returns `CONFIRMED` and a `DR-` reference; a second overlapping booking raises the exclusion error; a closed day rejects a weekly slot; manual availability allows a slot on that same closed day; reschedule keeps the original `id` and frees the old slot; cancelling frees the slot; a cancelled booking cannot be rescheduled; inactive doctors and clinics cannot be booked.

- [ ] **Step 3: Commit**

`git add supabase/migrations/0005_booking_rpcs.sql && git commit -m "feat(db): add transactional booking RPCs"`

### Task 6: Doctor photo storage

**Files:**
- Create: `supabase/migrations/0006_doctor_photos_storage.sql`

**Interfaces:**
- Consumes: `storage.buckets`
- Produces: public bucket `doctor-photos` only. Supabase already enables RLS on `storage.objects`, and migrations cannot alter that managed table.

- [ ] **Step 1: Write the migration**

Insert the public `doctor-photos` bucket with a 5 MB file-size limit and allowed image MIME types using an idempotent insert. Do not alter `storage.objects` or create policies there; owner uploads will use a server-side route with the service-role key, and public downloads use the bucket's public URL.

- [ ] **Step 2: Verify the storage setup**

Apply 0001–0006 in PGlite with stub `storage.buckets`/`storage.objects`. Assert the bucket exists, is public, has the size limit, and that the migration contains no privileged `storage.objects` statements.

- [ ] **Step 3: Commit**

`git add supabase/migrations/0006_doctor_photos_storage.sql && git commit -m "feat(db): add doctor photo storage bucket"`

### Task 7: Fictional demo seed data

**Files:**
- Create: `supabase/seed.sql`

**Interfaces:**
- Consumes: all tables from Tasks 1–3
- Produces: fictional demo rows only; no auth users are created here.

- [ ] **Step 1: Write the seed**

Use stable text keys with a commented `DEMO / FICTIONAL` header. Insert at least 3 clinics, 5 specialties, 7 doctors (varied fees, slot durations, and one inactive), weekly schedules for every active doctor, manual availability on selected dates, at least one `CLOSED` and one `MODIFIED_HOURS` exception, and sample appointments across `CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `CANCELLED`, `NO_SHOW` with unique references/QR tokens. Use relative dates via `current_date` so the demo always shows upcoming slots.

- [ ] **Step 2: Verify the seed applies and meets the dataset requirements**

Apply 0001–0006 then `seed.sql` in PGlite. Assert counts (clinics ≥ 3, specialties ≥ 5, doctors ≥ 7), every active doctor has a weekly schedule, both exception types exist, manual availability exists, all five statuses appear, and no booking overlaps an active booking.

- [ ] **Step 3: Commit**

`git add supabase/seed.sql && git commit -m "feat(db): add fictional demo dataset"`

### Task 8: Shared TypeScript database types

**Files:**
- Create: `src/types/database.ts`

**Interfaces:**
- Consumes: final SQL schema
- Produces: `Database`, `Tables`, `Clinic`, `Specialty`, `Doctor`, `WeeklySchedule`, `ManualAvailability`, `ScheduleException`, `Appointment`, `AdminProfile` type aliases usable by `src/lib/supabase/*` and later services.

- [ ] **Step 1: Write the types**

Define a Supabase-compatible `Database` namespace with `public.Tables.<name>.Row/Insert/Update` shapes matching every SQL column exactly (snake_case, `string` UUIDs, `string` dates/times/numeric). Export row aliases and string-literal unions for appointment status, exception type, and admin role. Add no runtime code.

- [ ] **Step 2: Verify the types compile**

Run `npm run typecheck`; expect no errors. Confirm each SQL table has a matching `Tables` entry and no table is missing.

- [ ] **Step 3: Commit**

`git add src/types/database.ts && git commit -m "feat(types): add Supabase database types"`

### Task 9: Final Phase 2 review

**Files:**
- Modify: `IMPLEMENTATION-PLAN.md` (Phase 2 tracker → Completed)

- [ ] **Step 1: Re-apply every migration and the seed from scratch**

Run the PGlite harness against an empty database, applying 0001–0006 and `seed.sql` in order, then re-run all assertions from Tasks 1–8. Confirm no SQL errors.

- [ ] **Step 2: Run project checks**

Run `npm run typecheck`, `npm run lint`, and `npm run build`; all must pass. Check `git status` to confirm only intended files changed and no secrets or `.env.local` are staged.

- [ ] **Step 3: Mark the phase complete and commit**

Set Phase 2 to `Completed` in the tracker, then `git add IMPLEMENTATION-PLAN.md && git commit -m "chore: mark Phase 2 complete"`. Push `dev` and report the results.
