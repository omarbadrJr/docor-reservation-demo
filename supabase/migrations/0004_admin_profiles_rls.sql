-- Phase 2 / Task 4: staff accounts linked to Supabase Auth, plus baseline RLS.
-- No custom password hashes: id references auth.users(id) directly.

create table public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  email text not null unique check (length(btrim(email)) > 0),
  role text not null check (role in ('OWNER', 'RECEPTIONIST')),
  clinic_id uuid references public.clinics(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_profiles_clinic_check check (
    (role = 'OWNER' and clinic_id is null)
    or (role = 'RECEPTIONIST' and clinic_id is not null)
  )
);

create trigger admin_profiles_set_updated_at
before update on public.admin_profiles
for each row execute function public.set_updated_at();

create index admin_profiles_clinic_id_idx on public.admin_profiles (clinic_id);
create index admin_profiles_role_idx on public.admin_profiles (role);

create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select role from public.admin_profiles
  where id = auth.uid() and is_active;
$$;

create or replace function public.current_admin_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select clinic_id from public.admin_profiles
  where id = auth.uid() and is_active;
$$;

grant usage on schema public to anon, authenticated;

-- Catalog data is public to read only when both the record and its doctor/clinic are active.
alter table public.clinics enable row level security;
create policy "Public can read active clinics" on public.clinics
for select to anon, authenticated using (is_active);

alter table public.specialties enable row level security;
create policy "Public can read active specialties" on public.specialties
for select to anon, authenticated using (is_active);

alter table public.doctors enable row level security;
create policy "Public can read active doctors" on public.doctors
for select to anon, authenticated using (
  is_active and exists (
    select 1 from public.clinics c
    where c.id = clinic_id and c.is_active
  )
);

alter table public.weekly_schedules enable row level security;
create policy "Public can read schedules of active doctors" on public.weekly_schedules
for select to anon, authenticated using (
  is_active and exists (
    select 1 from public.doctors d
    join public.clinics c on c.id = d.clinic_id
    where d.id = doctor_id and d.is_active and c.is_active
  )
);

alter table public.manual_availability enable row level security;
create policy "Public can read manual availability of active doctors" on public.manual_availability
for select to anon, authenticated using (
  exists (
    select 1 from public.doctors d
    join public.clinics c on c.id = d.clinic_id
    where d.id = doctor_id and d.is_active and c.is_active
  )
);

alter table public.schedule_exceptions enable row level security;
create policy "Public can read exceptions of active doctors" on public.schedule_exceptions
for select to anon, authenticated using (
  exists (
    select 1 from public.doctors d
    join public.clinics c on c.id = d.clinic_id
    where d.id = doctor_id and d.is_active and c.is_active
  )
);

-- Appointments are never readable by guests and are written only through SECURITY DEFINER RPCs.
alter table public.appointments enable row level security;
create policy "Owner can read all appointments" on public.appointments
for select to authenticated using (public.current_admin_role() = 'OWNER');
create policy "Receptionist can read own clinic appointments" on public.appointments
for select to authenticated using (
  public.current_admin_role() = 'RECEPTIONIST'
  and clinic_id = public.current_admin_clinic_id()
);

alter table public.admin_profiles enable row level security;
create policy "Staff can read own profile" on public.admin_profiles
for select to authenticated using (id = auth.uid());
create policy "Owner can read all staff profiles" on public.admin_profiles
for select to authenticated using (public.current_admin_role() = 'OWNER');

-- Supabase grants broad table privileges by default; keep the public surface read-only.
revoke all on public.clinics, public.specialties, public.doctors,
  public.weekly_schedules, public.manual_availability, public.schedule_exceptions
  from anon, authenticated;
grant select on public.clinics, public.specialties, public.doctors,
  public.weekly_schedules, public.manual_availability, public.schedule_exceptions
  to anon, authenticated;

revoke all on public.appointments, public.admin_profiles from anon, authenticated;
grant select on public.appointments, public.admin_profiles to authenticated;
