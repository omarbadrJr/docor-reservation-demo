-- Phase 2 / Task 1: core catalog tables.
-- Demo records are added separately in supabase/seed.sql and are fictional.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  address text not null check (length(btrim(address)) > 0),
  phone text not null check (length(btrim(phone)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clinics_set_updated_at
before update on public.clinics
for each row execute function public.set_updated_at();

create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) > 0),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger specialties_set_updated_at
before update on public.specialties
for each row execute function public.set_updated_at();

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  specialty_id uuid not null references public.specialties(id) on delete restrict,
  full_name text not null check (length(btrim(full_name)) > 0),
  photo_url text,
  bio text,
  qualifications text,
  experience_years integer check (experience_years >= 0),
  consultation_fee numeric(10, 2) not null check (consultation_fee >= 0),
  slot_duration_minutes integer not null check (slot_duration_minutes between 5 and 480),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger doctors_set_updated_at
before update on public.doctors
for each row execute function public.set_updated_at();

create index doctors_clinic_id_idx on public.doctors (clinic_id);
create index doctors_specialty_id_idx on public.doctors (specialty_id);
create index doctors_is_active_idx on public.doctors (is_active);
