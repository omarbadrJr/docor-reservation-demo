# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Doctor Appointment Booking Platform (MVP)** — Mobile-first, RTL web platform in simple Egyptian colloquial Arabic (**عامية مصرية**) for booking doctor appointments in one local area in Beheira, Egypt. Designed for users with limited technical experience.

**Current Phase**: Phase 1 (Project Setup) completed. Next: Phase 2 (Database Design).

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
npm run typecheck    # next typegen && tsc --noEmit
npm run lint         # ESLint
npm run build        # Production build (Turbopack)
```

## Architecture & Structure

```
doctor-booking/
├── src/
│   ├── app/
│   │   ├── (patient)/          # Patient-facing pages (specialties, doctors, booking, my-booking)
│   │   ├── (auth)/login/       # Login page for Owner/Receptionist
│   │   ├── owner/              # Owner dashboard (clinics, doctors, receptionists, appointments)
│   │   ├── receptionist/       # Receptionist dashboard (appointments, check-in)
│   │   ├── api/                # Server-side Route Handlers (appointments, availability)
│   │   ├── layout.tsx          # Root layout (needs lang="ar", dir="rtl")
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                 # Reusable shadcn/ui primitives
│   │   ├── layout/             # Layout shells (patient, dashboard)
│   │   ├── doctors/            # Doctor cards, profiles
│   │   ├── booking/            # Booking flow components
│   │   └── dashboard/          # Dashboard-specific components
│   ├── lib/
│   │   ├── supabase/           # Supabase clients (client.ts, server.ts, admin.ts, env.ts)
│   │   ├── validations/        # Zod schemas
│   │   └── utils.ts
│   ├── services/               # Business logic (appointments.ts, availability.ts, doctors.ts, clinics.ts)
│   └── types/
│       └── database.ts         # Shared TypeScript/database types
├── supabase/
│   ├── migrations/             # Version-controlled SQL migrations
│   └── seed.sql                # Fictional demo data (clearly marked)
└── public/
```

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4 + shadcn/ui + lucide-react
- **Backend/DB**: Supabase (PostgreSQL + Supabase JS + SQL migrations)
- **Auth**: Supabase Auth (email + password) for Owner/Receptionist only; no public registration
- **Libraries**: zod, react-hook-form, date-fns, qrcode

## Critical Invariants (Never Violate)

1. **Backend = Availability Source of Truth** — Never rely on frontend for slot availability
2. **Transactional Double-Booking Prevention** — PostgreSQL transactions + exclusion constraints
3. **Atomic Rescheduling/Cancellation** — Release old slot, reserve new slot in one transaction
4. **Booking Statuses**: `CONFIRMED` → `CHECKED_IN` → `COMPLETED` / `CANCELLED` / `NO_SHOW`
5. **References & QR Tokens** — Unique, non-reusable reference (e.g., `DR-8K29P4`) + secure `qr_token`
6. **Patient Lookup** — By reference OR phone number (multiple bookings shown for phone)
7. **Schedule Precedence** — `ScheduleException` > `WeeklySchedule`; `ManualAvailability` adds extra
8. **Inactive Doctors** — Cannot receive new bookings; historical appointments accessible
9. **Server-side RBAC & Clinic Isolation** — Enforce on backend + DB policies, not just UI
10. **Secrets** — Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code

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

1. Follow phases in `IMPLEMENTATION-PLAN.md` sequentially
2. Verify each phase's acceptance criteria before advancing
3. Keep edits focused; avoid touching unrelated files
4. Run `typecheck`, `lint`, `build` before finishing changes
5. All demo/seed data must be clearly marked as fictional

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

// Server (server components, Route Handlers)
import { createClient } from '@/lib/supabase/server';
const supabase = await createClient();

// Admin (server-only, service role)
import { createAdminClient } from '@/lib/supabase/admin';
const supabase = createAdminClient();
```