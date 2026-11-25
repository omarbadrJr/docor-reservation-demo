# Project Structure

## Overview
The application uses one Next.js project containing:
- Public patient-facing website.
- Owner dashboard.
- Receptionist dashboard.
- Server-side API endpoints.
- Shared components and business logic.

## Directory Structure

```text
doctor-booking/
│
├── AGENTS.md
├── SRS.md
├── README.md
├── package.json
├── .env.example
├── .env.local
│
├── docs/
│   ├── TECH_STACK.md
│   ├── UI_UX.md
│   └── PROJECT_STRUCTURE.md
│
├── public/
│   ├── images/
│   └── doctors/
│
├── src/
│   ├── app/
│   │   ├── (patient)/
│   │   │   ├── page.tsx
│   │   │   ├── specialties/
│   │   │   ├── doctors/
│   │   │   ├── booking/
│   │   │   └── my-booking/
│   │   │
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │
│   │   ├── owner/
│   │   │   ├── page.tsx
│   │   │   ├── clinics/
│   │   │   ├── doctors/
│   │   │   ├── receptionists/
│   │   │   └── appointments/
│   │   │
│   │   ├── receptionist/
│   │   │   ├── page.tsx
│   │   │   ├── appointments/
│   │   │   └── check-in/
│   │   │
│   │   ├── api/
│   │   │   ├── appointments/
│   │   │   └── availability/
│   │   │
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── doctors/
│   │   ├── booking/
│   │   └── dashboard/
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   ├── validations/
│   │   └── utils.ts
│   │
│   ├── services/
│   │   ├── appointments.ts
│   │   ├── availability.ts
│   │   ├── doctors.ts
│   │   └── clinics.ts
│   │
│   └── types/
│       └── database.ts
│
└── supabase/
    ├── migrations/
    └── seed.sql
```

## Directory Responsibilities

### src/app/
Contains pages, layouts, loading states, error states, and API Route Handlers.

### src/components/
Contains reusable UI components. Avoid duplicating components across pages.

### src/lib/
Contains shared utilities, Supabase clients, and validation schemas.

### src/services/
Contains application business logic, including appointment operations and availability calculations.

### src/types/
Contains shared TypeScript types.

### supabase/
Contains database migrations and seed data.

## Architecture Rules
- Keep page components focused on rendering and coordinating UI.
- Do not put complex business logic directly inside page components.
- Reuse components where appropriate.
- Keep database operations and sensitive logic on the server.
- Use Route Handlers for server-side API operations.
- Keep database migrations version-controlled.
- Follow the existing structure when adding new features.
- Do not create folders or abstraction layers without a practical reason.

## Important
This structure is the initial organizational guideline, not a requirement to create every file immediately.

Create files when their functionality is needed.