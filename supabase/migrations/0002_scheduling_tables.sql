-- Phase 2 / Task 2: doctor scheduling.
-- Exceptions override weekly schedules; manual availability adds extra windows.

create table public.weekly_schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (doctor_id, day_of_week, start_time, end_time)
);

create index weekly_schedules_doctor_day_idx
on public.weekly_schedules (doctor_id, day_of_week);

create table public.manual_availability (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  availability_date date not null,
  start_time time not null,
  end_time time not null check (end_time > start_time),
  created_at timestamptz not null default now(),
  unique (doctor_id, availability_date, start_time, end_time)
);

create index manual_availability_doctor_date_idx
on public.manual_availability (doctor_id, availability_date);

create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  exception_date date not null,
  exception_type text not null
    check (exception_type in ('CLOSED', 'MODIFIED_HOURS', 'EXTRA_HOURS')),
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz not null default now(),
  constraint schedule_exceptions_times_check check (
    (exception_type = 'CLOSED' and start_time is null and end_time is null)
    or (
      exception_type in ('MODIFIED_HOURS', 'EXTRA_HOURS')
      and start_time is not null
      and end_time is not null
      and end_time > start_time
    )
  )
);

create index schedule_exceptions_doctor_date_idx
on public.schedule_exceptions (doctor_id, exception_date);
