# Phase 5 — Scheduling and Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the backend the only source of truth for doctor working dates and bookable time slots.

**Architecture:** A pure availability engine (windows → slots → states) lives in `src/lib/availability.ts`, with Cairo-local clock/date helpers in `src/lib/cairo-time.ts`. `src/services/availability.ts` loads schedules, exceptions, manual windows, and active appointments from Supabase and calls the engine. Two read-only Route Handlers expose the result.

**Tech Stack:** Next.js App Router, TypeScript, Supabase JS, Zod, `node:test` via `tsx`, `Intl.DateTimeFormat` for `Africa/Cairo`.

**Spec:** `IMPLEMENTATION-PLAN.md` Phase 5; `SRS.md` §4.8–§4.9.

## Global Constraints

- The backend is the sole availability source of truth; never compute availability only in the browser.
- Mirror the existing `public.is_slot_available` rule: any exception for a date replaces that date's weekly windows; `manual_availability` windows are always added; a slot must fit inside one window.
- Database times stay `HH:MM:SS`; public availability payloads return `HH:MM`.
- Use `Africa/Cairo` for "today", current time, and past-slot exclusion.
- Do not add dependencies; use `Intl` for timezone conversion.
- User-facing errors use natural Egyptian Arabic.
- Work directly on `dev`, commit per task, and do not push.

## Review Focus

- Egypt DST changes: Cairo can be UTC+2 or UTC+3, so never compare against UTC wall time.
- Overlapping windows must not create duplicate or partially spanning slots.
- A `CLOSED` exception blocks weekly windows but must not block manual availability.
- Invalid calendar dates such as `2026-02-31` must be rejected, not rolled over.
- Inactive doctors and inactive clinics must expose no availability at all.

---

### Task 1: Cairo clock and calendar helpers

**Files:**
- Create: `src/types/availability.ts`
- Create: `src/lib/cairo-time.ts`
- Test: `src/lib/cairo-time.test.ts`

**Interfaces:**
- Produces: `CairoNow = { date: string; time: string }`
- Produces: `getCairoNow(now?: Date): CairoNow`
- Produces: `listDatesInMonth(month: string): string[]`
- Produces: `dayOfWeek(date: string): number`
- Produces: `AvailabilityDateState`, `TimeWindow`, `TimeSlot`, `DoctorAvailability`, `AvailableDate`

- [ ] **Step 1: Write failing tests for winter/summer Cairo time, leap-month lengths, and weekday numbers.**
- [ ] **Step 2: Run `npm test` and verify the new tests fail.**
- [ ] **Step 3: Implement the types and helpers.**
- [ ] **Step 4: Run `npm test` and verify they pass.**
- [ ] **Step 5: Commit.**

---

### Task 2: Resolve working windows with precedence

**Files:**
- Create: `src/lib/availability.ts`
- Test: `src/lib/availability.test.ts`

**Interfaces:**
- Consumes: `TimeWindow`, `WeeklySchedule`, `ManualAvailability`, `ScheduleException`.
- Produces: `resolveWorkingWindows(date: string, source: WorkingWindowSource): TimeWindow[]`

- [ ] **Step 1: Write failing tests for normal weekly windows, `CLOSED` + manual availability, `MODIFIED_HOURS`/`EXTRA_HOURS` replacing weekly windows, manual windows always added, and sorted output.**
- [ ] **Step 2: Run `npm test` and verify the tests fail.**
- [ ] **Step 3: Implement `resolveWorkingWindows`.**
- [ ] **Step 4: Run `npm test` and verify the tests pass.**
- [ ] **Step 5: Commit.**

---

### Task 3: Generate slots, remove booked slots, classify dates

**Files:**
- Modify: `src/lib/availability.ts`
- Test: `src/lib/availability.test.ts`

**Interfaces:**
- Consumes: `TimeWindow`, `TimeSlot`, `CairoNow`, `Appointment`.
- Produces: `generateSlots(windows: TimeWindow[], slotDurationMinutes: number, date: string, now: CairoNow): TimeSlot[]`
- Produces: `filterBookedSlots(slots: TimeSlot[], appointments: BookedWindow[], date: string): TimeSlot[]`
- Produces: `classifyAvailability(windows: TimeWindow[], slots: TimeSlot[]): AvailabilityDateState`

- [ ] **Step 1: Write failing tests for slot duration/alignment, deduplication, past-slot exclusion, booked-overlap removal, and `OFF`/`FULL`/`AVAILABLE` classification.**
- [ ] **Step 2: Run `npm test` and verify the tests fail.**
- [ ] **Step 3: Implement the three functions.**
- [ ] **Step 4: Run `npm test` and verify the tests pass.**
- [ ] **Step 5: Commit.**

---

### Task 4: Load availability from Supabase

**Files:**
- Create: `src/services/availability.ts`
- Test: `src/services/availability.test.ts`

**Interfaces:**
- Consumes: `CatalogClient`, `getActiveClinic`, engine helpers.
- Produces: `getDoctorAvailability(client, doctorId, date, now?): Promise<DoctorAvailability | null>`
- Produces: `listDoctorAvailableDates(client, doctorId, month, now?): Promise<AvailableDate[] | null>`

- [ ] **Step 1: Write failing tests with a fake Supabase client for active doctor, inactive doctor/clinic, weekly slots, closed exception + manual availability, booked overlap, cancelled booking, and month classification.**
- [ ] **Step 2: Run `npm test` and verify the tests fail.**
- [ ] **Step 3: Implement the service using the engine helpers.**
- [ ] **Step 4: Run `npm test` and verify the tests pass.**
- [ ] **Step 5: Commit.**

---

### Task 5: Validate month and date query parameters

**Files:**
- Create: `src/lib/validations/availability.ts`
- Test: `src/lib/validations/availability.test.ts`

**Interfaces:**
- Produces: `parseMonth(value: string | null): string | null`
- Produces: `parseAvailabilityDate(value: string | null): string | null`

- [ ] **Step 1: Write failing tests for valid values, missing values, malformed months, and impossible dates like `2026-02-31`.**
- [ ] **Step 2: Run `npm test` and verify the tests fail.**
- [ ] **Step 3: Implement both parsers.**
- [ ] **Step 4: Run `npm test` and verify the tests pass.**
- [ ] **Step 5: Commit.**

---

### Task 6: Expose availability API routes

**Files:**
- Create: `src/app/api/doctors/[id]/available-dates/route.ts`
- Create: `src/app/api/doctors/[id]/availability/route.ts`

**Interfaces:**
- Consumes: `parseCatalogId`, `parseMonth`, `parseAvailabilityDate`, service functions.
- Produces: `GET /api/doctors/:id/available-dates?month=YYYY-MM`
- Produces: `GET /api/doctors/:id/availability?date=YYYY-MM-DD`

- [ ] **Step 1: Implement the two thin handlers with 400/404/500 Arabic responses.**
- [ ] **Step 2: Run `npm run typecheck`, `npm run lint`, and `npm run build`.**
- [ ] **Step 3: Manually verify both routes against the seeded Supabase data.**
- [ ] **Step 4: Commit.**

---

### Task 7: Verify Phase 5 and update the tracker

**Files:**
- Modify: `IMPLEMENTATION-PLAN.md`

- [ ] **Step 1: Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.**
- [ ] **Step 2: Verify all Phase 5 acceptance criteria.**
- [ ] **Step 3: Mark Phase 5 `Completed` in the tracker.**
- [ ] **Step 4: Commit.**
