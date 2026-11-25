# Technology Stack

## Frontend
- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- shadcn/ui for reusable UI components
- Lucide React for icons

## Backend
- Supabase
- Next.js Route Handlers for server-side API endpoints.
- Server-side business logic for booking, rescheduling, cancellation, and availability.

## Database
- PostgreSQL hosted by Supabase.
- Supabase JS for database access.
- SQL migrations to manage schema changes.
- PostgreSQL transactions and constraints to prevent double-booking.

## Authentication
- Supabase Auth.
- Email and password sign-in for Owner and Receptionists.
- No public registration.
- No patient accounts or patient authentication.

## Supporting Libraries
- Zod: validation.
- React Hook Form: form management.
- date-fns: date and time handling.
- qrcode: QR code generation.

## Architecture Rules
- Use one Next.js application for the patient website and both dashboards.
- Do not create a separate backend application.
- Keep business logic separate from UI components.
- Use server-side logic for sensitive operations.
- Never expose the Supabase service-role key to the browser.
- Use environment variables for credentials and configuration.
- Use TypeScript throughout the application.

## Avoid
- NestJS or Express as a separate backend.
- Prisma unless a specific need arises.
- Redis.
- Microservices.
- Unnecessary dependencies.
- Payments and OTP authentication.

## Development Environment
- Node.js LTS
- npm
- Git
- Supabase hosted project for database and authentication