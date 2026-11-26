# Phase 4 Public Doctor Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a guest patient move from the homepage to active specialties, then to active doctors and a doctor profile, backed by public read-only APIs and server-side catalog services.

**Architecture:** Server Components call catalog services directly for first paint; public Route Handlers call the same services for API consumers. RLS already restricts guests to active records, and services also filter active doctors, specialties, and clinics so the UI cannot leak deactivated catalog data.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind, shadcn-style UI primitives, Lucide, Supabase JS, Zod, `node:test` via `tsx`.

**Spec:** `SRS.md` §§4.2–4.4, §8, §9, §10, §12; `IMPLEMENTATION-PLAN.md` Phase 4; `DESIGN.md`; `docs/UI_UX.md`.

## Global Constraints

- Use natural Egyptian colloquial Arabic and RTL everywhere.
- Preserve canonical labels: `عايز تكشف عند دكتور إيه؟`, `احجز عند دكتور`, `عندي حجز بالفعل`, `اختار التخصص`, `المواعيد المتاحة`, `أكّد الحجز`.
- Exclude inactive doctors, inactive specialties, and doctors at inactive clinics from every public surface.
- Keep all demo records fictional; do not add patient accounts, payments, notifications, or other out-of-scope MVP features.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only; public catalog reads use the anon server client.
- Run `npm run typecheck`, `npm run lint`, and `npm run build` before finishing the phase.
- Use the Slip + stamp design tokens in `DESIGN.md`; no colored glow shadows, blur, icon chips, or invented one-off palettes.

## Review Focus

- An inactive doctor or a doctor at an inactive clinic must not appear in listings, profiles, or API responses — tested in Task 1 service tests.
- A malformed or repeated `specialtyId` query parameter must not reach the database — tested in Task 1 validation tests.
- A doctor with no photo or no bio must still render a useful card/profile — tested in Task 2 and Task 4 component tests.
- Consultation fees from Postgres numeric strings must render as readable Egyptian pounds, not raw decimals — tested in Task 2 format tests.
- The profile's available-slots entry point must remain a stable link even before Phase 5 builds the availability UI — tested in Task 4 and handled with a minimal placeholder page.

---

### Task 1: Catalog services, validation, test runner, and public APIs

**Files:**
- Create: `src/types/catalog.ts`
- Create: `src/lib/validations/catalog.ts`
- Create: `src/lib/validations/catalog.test.ts`
- Create: `src/services/specialties.ts`
- Create: `src/services/clinics.ts`
- Create: `src/services/doctors.ts`
- Create: `src/services/catalog.test.ts`
- Create: `src/app/api/specialties/route.ts`
- Create: `src/app/api/doctors/route.ts`
- Create: `src/app/api/doctors/[id]/route.ts`
- Modify: `package.json`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: `Database` from `src/types/database.ts`, `createClient` from `src/lib/supabase/server.ts`.
- Produces:
  - `SpecialtySummary = Pick<Specialty, "id" | "name" | "description">`
  - `ClinicSummary = Pick<Clinic, "id" | "name" | "address">`
  - `DoctorCardData = { id; fullName; specialtyName; bio; clinicName; clinicAddress; consultationFee }`
  - `DoctorProfileData = DoctorCardData & { photoUrl; qualifications; experienceYears; workingSchedule: Array<{ day_of_week; start_time; end_time }> }`
  - `listActiveSpecialties(client?)`, `getActiveSpecialty(client, id)`
  - `getActiveClinic(client, id)`
  - `listDoctorsBySpecialty(client, specialty)`, `getPublicDoctorById(client, id)`
  - `parseSpecialtyId(value): string | null`

- [x] **Step 1: Add the test runner**

  Install `tsx` as a dev dependency. Add `"test": "tsx --test \"src/**/*.test.ts\" \"src/**/*.test.tsx\""` to `package.json`. Document the exact command in `AGENTS.md` under Commands.

- [x] **Step 2: Write failing validation tests**

  Create `src/lib/validations/catalog.test.ts` asserting that a UUID string is returned, a non-UUID string returns `null`, and an array of values returns `null`.

- [x] **Step 3: Run the validation test and verify it fails**

  Run: `npm test -- src/lib/validations/catalog.test.ts`
  Expected: FAIL because `src/lib/validations/catalog.ts` does not exist.

- [x] **Step 4: Implement validation and catalog DTO types**

  Create `src/lib/validations/catalog.ts` using Zod UUID validation and `src/types/catalog.ts` with the exact DTOs in Interfaces.

- [x] **Step 5: Run the validation test and verify it passes**

  Run: `npm test -- src/lib/validations/catalog.test.ts`
  Expected: PASS.

- [x] **Step 6: Write failing service tests**

  Create `src/services/catalog.test.ts` with a fake Supabase query builder that applies `eq`/`in` filters and supports `order`/`maybeSingle`. Assert:
  - `listDoctorsBySpecialty` returns only doctors at active clinics and maps hand-checked fields.
  - `getPublicDoctorById` returns `null` for an active doctor whose clinic is inactive.
  - `getPublicDoctorById` returns `null` for a missing doctor.

- [x] **Step 7: Run the service test and verify it fails**

  Run: `npm test -- src/services/catalog.test.ts`
  Expected: FAIL because service modules do not exist.

- [x] **Step 8: Implement catalog services**

  Implement the exact signatures in Interfaces. Query only active specialties/clinics/doctors and active weekly schedules. Throw on Supabase errors with a clear Arabic message.

- [x] **Step 9: Run the service test and verify it passes**

  Run: `npm test -- src/services/catalog.test.ts`
  Expected: PASS.

- [x] **Step 10: Implement public Route Handlers**

  - `GET /api/specialties` returns `{ specialties }`.
  - `GET /api/doctors?specialtyId=...` returns `{ doctors }`; invalid/missing id returns 400 with Arabic message; unknown active specialty returns 404.
  - `GET /api/doctors/:id` returns `{ doctor }` or 404 Arabic message.

- [x] **Step 11: Verify APIs against the local dev server**

  Start `npm run dev` and curl the three endpoints plus an invalid `specialtyId`. Expected: 200 for seeded active data, 400 for malformed input, 404 for unknown ids.

- [x] **Step 12: Commit**

  `git add` only the files in this task and commit with `feat(api): add public catalog services and routes`.

---

### Task 2: Specialty selection page and formatting helpers

**Files:**
- Create: `src/lib/format.ts`, `src/lib/format.test.ts`
- Create: `src/lib/schedule.ts`, `src/lib/schedule.test.ts`
- Create: `src/components/doctors/specialty-card.tsx`, `src/components/doctors/specialty-card.test.tsx`
- Create: `src/components/doctors/doctor-photo.tsx`
- Create: `public/doctors/demo-portrait.svg`
- Modify: `supabase/seed.sql`
- Modify: `src/app/(patient)/specialties/page.tsx`
- Create: `src/app/(patient)/specialties/loading.tsx`
- Create: `src/app/(patient)/specialties/error.tsx`

**Interfaces:**
- Consumes: `SpecialtySummary` from Task 1, `listActiveSpecialties`.
- Produces: `formatConsultationFee(value: string): string`, `formatExperienceYears(years: number | null): string | null`, `formatWorkingSchedule(rows)` returning Arabic day labels, `SpecialtyCard`, `DoctorPhoto`.

- [x] **Step 1: Write failing format and schedule tests**

  Assert `formatConsultationFee("150.00") === "150 جنيه"`, `formatExperienceYears(null) === null`, and day `0` maps to `الأحد` while day `5` maps to `الجمعة`.

- [x] **Step 2: Run them and verify they fail**

  Run: `npm test -- src/lib/format.test.ts src/lib/schedule.test.ts`
  Expected: FAIL because modules do not exist.

- [x] **Step 3: Implement format and schedule helpers**

  Use `Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })` and a fixed Arabic weekday array.

- [x] **Step 4: Run them and verify they pass**

  Run: `npm test -- src/lib/format.test.ts src/lib/schedule.test.ts`
  Expected: PASS.

- [x] **Step 5: Write a failing specialty card test**

  Render `SpecialtyCard` with `renderToStaticMarkup` and assert the link href contains the exact specialty id and the name/description appear.

- [x] **Step 6: Run it and verify it fails**

  Run: `npm test -- src/components/doctors/specialty-card.test.tsx`
  Expected: FAIL because the component does not exist.

- [x] **Step 7: Implement `SpecialtyCard` and `DoctorPhoto`**

  Use Link cards with a Lucide icon mapped by specialty name and a Stethoscope fallback. `DoctorPhoto` renders a bordered fallback silhouette when `photoUrl` is null; otherwise use `next/image` with `fill`, `unoptimized`, and `object-cover`.

- [x] **Step 8: Run the card test and verify it passes**

  Run: `npm test -- src/components/doctors/specialty-card.test.tsx`
  Expected: PASS.

- [x] **Step 9: Add fictional demo portrait and bios**

  Create one clearly fictional local SVG portrait and point every seeded doctor's `photo_url` to it. Add a short, different fictional `bio` to each seeded doctor so cards and profiles have all required fields without external image dependencies.

- [x] **Step 10: Replace the specialties placeholder page**

  Render `PageHeader` with `اختار التخصص`, map active specialties to `SpecialtyCard`, and use `EmptyState` with an Arabic explanation when none exist. Add `loading.tsx` and `error.tsx` using existing state components.

- [x] **Step 11: Verify the rendered page**

  Run: `curl -s http://localhost:3000/specialties | grep -F 'اختار التخصص'`
  Expected: the canonical heading is present.

- [x] **Step 12: Commit**

  Commit with `feat(patient): build specialty selection page`.

---

### Task 3: Doctor listing by specialty

**Files:**
- Create: `src/components/doctors/doctor-card.tsx`, `src/components/doctors/doctor-card.test.tsx`
- Create: `src/app/(patient)/doctors/page.tsx`
- Create: `src/app/(patient)/doctors/loading.tsx`
- Create: `src/app/(patient)/doctors/error.tsx`

**Interfaces:**
- Consumes: `DoctorCardData`, `getActiveSpecialty`, `listDoctorsBySpecialty`, `parseSpecialtyId`, `DoctorPhoto`, `formatConsultationFee`.
- Produces: `DoctorCard` and `/doctors?specialtyId=<uuid>` page.

- [x] **Step 1: Write a failing doctor card test**

  Render `DoctorCard` with a fixture containing a `null` bio and assert the doctor name, specialty, clinic name, clinic address, `150 جنيه`, the fallback bio text, and a link to `/doctors/<id>`.

- [x] **Step 2: Run it and verify it fails**

  Run: `npm test -- src/components/doctors/doctor-card.test.tsx`
  Expected: FAIL because the component does not exist.

- [x] **Step 3: Implement `DoctorCard`**

  Use the slip-like flat card pattern from `DESIGN.md`, with `DoctorPhoto`, plain text rows, fee, and a link to the profile.

- [x] **Step 4: Run it and verify it passes**

  Run: `npm test -- src/components/doctors/doctor-card.test.tsx`
  Expected: PASS.

- [x] **Step 5: Implement the doctors page**

  Await `searchParams`, parse `specialtyId`, redirect to `/specialties` when missing/invalid/unknown, then render `PageHeader` with the specialty name and a responsive list of `DoctorCard`. Use `EmptyState` when no active doctors exist.

- [x] **Step 6: Verify listing and inactive filtering**

  Curl a known seeded specialty id and confirm at least one active doctor appears; curl `/doctors?specialtyId=not-a-uuid` and confirm redirect to `/specialties`.

- [x] **Step 7: Commit**

  Commit with `feat(patient): list doctors by specialty`.

---

### Task 4: Doctor profile and stable availability entry point

**Files:**
- Create: `src/components/doctors/doctor-profile.tsx`, `src/components/doctors/doctor-profile.test.tsx`
- Create: `src/app/(patient)/doctors/[id]/page.tsx`
- Create: `src/app/(patient)/doctors/[id]/loading.tsx`
- Create: `src/app/(patient)/doctors/[id]/not-found.tsx`
- Create: `src/app/(patient)/booking/page.tsx`

**Interfaces:**
- Consumes: `DoctorProfileData`, `getPublicDoctorById`, `DoctorPhoto`, `formatConsultationFee`, `formatExperienceYears`, `formatWorkingSchedule`.
- Produces: `DoctorProfile` and `/doctors/[id]` page.

- [x] **Step 1: Write a failing profile component test**

  Render `DoctorProfile` with a fixture and assert full name, specialty, qualifications, experience, clinic name/address, fee, `الأحد` schedule label, and an available-slots link to `/booking?doctorId=<id>` with `المواعيد المتاحة`.

- [x] **Step 2: Run it and verify it fails**

  Run: `npm test -- src/components/doctors/doctor-profile.test.tsx`
  Expected: FAIL because the component does not exist.

- [x] **Step 3: Implement `DoctorProfile`**

  Use the slip pattern: identity row with photo, printed detail rows, qualifications/experience when present, clinic block with `عنوان العيادة`, working schedule summary, and one primary action link.

- [x] **Step 4: Run it and verify it passes**

  Run: `npm test -- src/components/doctors/doctor-profile.test.tsx`
  Expected: PASS.

- [x] **Step 5: Implement the profile page and not-found state**

  Await `params`, call `getPublicDoctorById`, call `notFound()` for missing/inactive doctors, and render `DoctorProfile`.

- [x] **Step 6: Add the minimal booking destination**

  Create `/booking` that reads `doctorId`, resolves the active doctor, and shows `المواعيد المتاحة` plus an `EmptyState` saying slots are being prepared. This is not the Phase 6 booking flow; it only keeps the profile action functional until availability is implemented.

- [x] **Step 7: Verify profile and inactive doctor behavior**

  Curl a seeded active doctor id and assert the name and `المواعيد المتاحة`; curl the seeded inactive doctor id and assert 404.

- [x] **Step 8: Commit**

  Commit with `feat(patient): build doctor profile and availability entry`.

---

### Task 5: Phase tracker and full verification

**Files:**
- Modify: `IMPLEMENTATION-PLAN.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: completed Phase 4 tracker entry and verified branch.

- [x] **Step 1: Update the phase tracker**

  Mark Phase 4 as Completed only after the acceptance checks below pass.

- [x] **Step 2: Run the test suite**

  Run: `npm test`
  Expected: PASS with all service, validation, format, schedule, and component tests green.

- [x] **Step 3: Run static checks**

  Run: `npm run typecheck && npm run lint && npm run build`
  Expected: all three commands exit 0.

- [x] **Step 4: Run the design scanner**

  Run: `node /Users/omarhany/.agents/skills/avoid-ai-design/scripts/detect.mjs src/app src/components DESIGN.md`
  Expected: 0 findings.

- [x] **Step 5: Verify mobile and desktop rendering**

  Use Playwright at 390px and 1440px for `/specialties`, `/doctors?specialtyId=<active-id>`, and `/doctors/<active-id>`. Expected: RTL layout, no horizontal overflow, readable text, and touch targets at least 44px.

- [x] **Step 6: Commit and open the PR**

  Commit with `chore: mark phase 4 complete`, push `feat/phase4-public-discovery`, and open the PR against `dev`.
