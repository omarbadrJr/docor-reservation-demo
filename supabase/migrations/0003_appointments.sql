-- Phase 2 / Task 3: appointments and database-level double-booking protection.
-- Only CONFIRMED and CHECKED_IN appointments reserve a doctor's slot.

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null unique
    check (reference_number ~ '^DR-[A-Z0-9]{6}$'),
  qr_token text not null unique,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  patient_name text not null check (length(btrim(patient_name)) > 0),
  patient_phone text not null check (length(btrim(patient_phone)) > 0),
  appointment_date date not null,
  start_time time not null,
  end_time time not null check (end_time > start_time),
  status text not null default 'CONFIRMED'
    check (status in ('CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint appointments_no_active_overlap exclude using gist (
    doctor_id with =,
    tstzrange(
      (appointment_date + start_time) at time zone 'Africa/Cairo',
      (appointment_date + end_time) at time zone 'Africa/Cairo',
      '[)'
    ) with &&
  ) where (status in ('CONFIRMED', 'CHECKED_IN'))
);

create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

create index appointments_doctor_date_status_idx
on public.appointments (doctor_id, appointment_date, status);

create index appointments_clinic_date_idx
on public.appointments (clinic_id, appointment_date);

create index appointments_patient_phone_idx
on public.appointments (patient_phone);

create index appointments_status_idx
on public.appointments (status);
