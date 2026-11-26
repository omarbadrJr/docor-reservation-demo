# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Doctor Appointment Booking Platform (MVP)** — Mobile-first, RTL web platform in simple Egyptian colloquial Arabic (**عامية مصرية**) for booking doctor appointments in one local area in Beheira, Egypt. Designed for users with limited technical experience.

**Current Phase**: Phases 1–7 completed (Project Setup, Database Design, Application Foundation, Public Doctor Discovery, Scheduling & Availability, Appointment Booking, Booking Management). Next: **Phase 8 (Authentication and Authorization)**.

## Key Documentation (Read Before Implementing)

| File | Purpose |
|------|---------|
| `SRS.md` | Full MVP requirements, roles, workflows, data model, API proposal, acceptance criteria (§10), implementation order (§11), demo dataset (§12) |
| `docs/TECH_STACK.md` | Approved stack, Supabase usage, technologies to avoid |
| `docs/PROJECT_STRUCTURE.md` | Target Next.js + Supabase directory layout and layering rules |
| `docs/UI_UX.md` | Egyptian Arabic copy, RTL layout, accessibility guidelines |
| `IMPLEMENTATION-PLAN.md` | Phased execution roadmap, per-phase acceptance criteria, completion tracker |
| `AGENTS.md` | Operational guide for coding agents (this project's rules) |

## Commands

```bash
# Development
npm run dev          # Start dev server at http://localhost:3000

# Verification (run all before finishing changes)
npm test             # tsx --test "src/**/*.test.ts" "src/**/*.test.tsx"
npm run typecheck    # next typegen && tsc --noEmit
npm run lint         # ESLint
npm run build        # Production build (Turbopack)
```

## Architecture & Structure

```text
Doctor-reservation-demo/
├── src/
│   ├── app/
│   │   ├── (patient)/          # Patient-facing pages (page.tsx, specialties/, doctors/, doctors/[id]/, booking/, my-booking/)
│   │   ├── (auth)/login/       # Login page for Owner/Receptionist (upcoming — Phase 8)
│   │   ├── owner/              # Owner dashboard shells (clinics/, doctors/, receptionists/, appointments/ — Phase 9)
│   │   ├── receptionist/       # Receptionist dashboard shells (appointments/, check-in/ — Phase 10)
│   │   ├── api/                # Server-side Route Handlers:
│   │   │                       #   specialties, doctors, doctors/[id], doctors/[id]/available-dates,
│   │   │                       #   doctors/[id]/availability, appointments, appointments/lookup,
│   │   │                       #   appointments/[id]/reschedule, appointments/[id]/cancel
│   │   ├── layout.tsx          # Root layout (lang="ar", dir="rtl", Cairo/Tajawal fonts, <Analytics />)
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                 # Reusable shadcn/ui (@base-ui/react) primitives
│   │   ├── layout/             # Layout shells (patient-shell.tsx, dashboard-shell.tsx, page-header.tsx)
│   │   ├── doctors/            # Specialty cards, doctor cards, doctor profile, doctor photo
│   │   ├── booking/            # Date/slot pickers, booking flow, confirmation slip, lookup/reschedule/cancel components
│   │   └── dashboard/          # Dashboard-specific components (upcoming)
│   ├── lib/
│   │   ├── supabase/           # Supabase clients (client.ts, server.ts, anon.ts, admin.ts, env.ts)
│   │   ├── validations/        # Zod schemas (catalog.ts, availability.ts, appointments.ts)
│   │   ├── availability.ts     # Pure slot generation & overlap filtering helpers
│   │   ├── cairo-time.ts       # Africa/Cairo current date/time & calendar helpers
│   │   ├── format.ts           # Deterministic Arabic dates & currency/experience formatting
│   │   ├── qr.ts               # PNG QR data URL generator via qrcode
│   │   ├── schedule.ts         # 12-hour Arabic time formatting (الصبح / مساءً)
│   │   └── utils.ts
│   ├── services/               # Server-side business logic (appointments.ts, availability.ts, doctors.ts, clinics.ts, specialties.ts)
│   └── types/                  # Shared TypeScript types (database.ts, catalog.ts, availability.ts, booking.ts)
├── supabase/
│   ├── migrations/             # Version-controlled SQL migrations (0001–0007)
│   └── seed.sql                # Fictional demo data (clearly marked)
└── public/
```

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack, `cacheComponents: true`, `partialPrefetching: true`) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4 + `shadcn/ui` (`@base-ui/react`) + `lucide-react`
- **Backend/DB**: Supabase (PostgreSQL + `@supabase/supabase-js` + `@supabase/ssr` + SQL migrations `0001`–`0007`)
- **Auth**: Supabase Auth (email + password) for Owner/Receptionist only; no public registration
- **Libraries**: `zod` (v4), `react-hook-form`, `@hookform/resolvers`, `date-fns`, `qrcode`

## Critical Invariants (Never Violate)

1. **Backend = Availability Source of Truth** — Never rely on frontend for slot availability (`AVAILABLE`, `FULL`, `OFF`).
2. **Cairo Timezone & Time Contract** — Compute dates, windows, and slots in `Africa/Cairo` (`src/lib/cairo-time.ts`); store/transfer `HH:MM(:SS)` and format for display only in UI (`src/lib/schedule.ts`, `الصبح` / `مساءً`).
3. **Transactional Double-Booking Prevention** — PostgreSQL `btree_gist` exclusion constraint + `service_role`-gated booking RPCs (`0007_harden_booking_rpcs.sql`).
4. **Atomic Rescheduling/Cancellation** — Release old slot, reserve new slot in one transaction; `CANCELLED` immediately frees the slot.
5. **Booking Statuses**: `CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `CANCELLED`, `NO_SHOW` (immediately `CONFIRMED` on creation).
6. **References & QR Tokens** — Unique, non-reusable reference (e.g., `DR-8K29P4`) + secure, non-guessable `qr_token` (never exposed directly in public JSON).
7. **Patient Lookup** — By reference OR phone number (multiple bookings shown for phone, sorted upcoming-first).
8. **Schedule Precedence** — `ScheduleException` > `WeeklySchedule`; `ManualAvailability` adds extra windows.
9. **Inactive Doctors / Clinics / Specialties** — Cannot receive new bookings or reschedules; historical appointments remain accessible to authorized staff.
10. **Server-side RBAC & Clinic Isolation** — Enforce on backend + DB policies, not just UI.
11. **Secrets** — Never expose `SUPABASE_SERVICE_ROLE_KEY` or import `createAdminClient()` in browser/client code.

## Arabic Copy Requirements (Canonical Labels)

| Context | Label |
|---------|-------|
| Homepage heading | `عايز تكشف عند دكتور إيه؟` |
| Primary action A | `احجز عند دكتور` |
| Primary action B | `عندي حجز بالفعل` |
| Select specialty | `اختار التخصص` |
| Available appointments | `المواعيد المتاحة` |
| Confirm booking | `أكّد الحجز` |
| Booking reference | `رقم الحجز` |
| Clinic address | `عنوان العيادة` |
| Reschedule | `غيّر معادك` |
| Cancel | `إلغاء الحجز` |
| Cancel confirmation | `متأكد إنك عايز تلغي الحجز؟` |
| Receptionist check-in | `تسجيل وصول المريض` |

## Development Workflow

1. Follow phases in `IMPLEMENTATION-PLAN.md` sequentially and update its Phase Tracker when a phase starts/completes.
2. Verify each phase's acceptance criteria (plus `SRS.md` §10 scenarios) before advancing.
3. Keep edits focused; avoid touching unrelated files.
4. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` before finishing changes.
5. Branch via `feat/...` / `fix/...` → `dev` (via PR) → `main` (via PR); always include `AGENTS.md` when committing authorized changes.
6. All demo/seed data must be clearly marked as fictional.

## Environment

```bash
# .env.local (never commit)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server-only!
```

## Out of Scope (Do Not Add)

Patient accounts/registration/login, OTP verification, online payments, medical records/history, video consultations, prescriptions, insurance integrations, SMS/WhatsApp notifications, multi-city/multi-region selection, doctor accounts/dashboards, multi-clinic assignment for one doctor, separate backend servers, Redis, microservices, Prisma.

## Supabase Client Patterns

```typescript
// Browser (client components)
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();

// Public read-only (server components / public catalog routes)
import { createAnonClient } from '@/lib/supabase/anon';
const supabase = createAnonClient();

// Server (cookie-based SSR / auth routes)
import { createClient } from '@/lib/supabase/server';
const supabase = await createClient();

// Admin (server-only, service role)
import { createAdminClient } from '@/lib/supabase/admin';
const supabase = createAdminClient();
```
