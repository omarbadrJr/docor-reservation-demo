-- Phase 2 / Task 5: transactional booking operations.
-- The database remains the source of truth for slot availability and overlap checks.

create or replace function public.is_slot_available(
  p_doctor_id uuid,
  p_date date,
  p_start time,
  p_end time
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ok boolean;
begin
  if p_doctor_id is null or p_date is null or p_start is null or p_end is null or p_end <= p_start then
    return false;
  end if;

  if not exists (
    select 1
    from public.doctors d
    join public.clinics c on c.id = d.clinic_id
    where d.id = p_doctor_id and d.is_active and c.is_active
  ) then
    return false;
  end if;

  if (p_date + p_start) at time zone 'Africa/Cairo' <= now() then
    return false;
  end if;

  -- Exceptions replace weekly windows for the date. Manual availability always adds windows.
  select exists (
    select 1
    from (
      select e.start_time, e.end_time
      from public.schedule_exceptions e
      where e.doctor_id = p_doctor_id
        and e.exception_date = p_date
        and e.exception_type in ('MODIFIED_HOURS', 'EXTRA_HOURS')

      union all

      select w.start_time, w.end_time
      from public.weekly_schedules w
      where w.doctor_id = p_doctor_id
        and w.day_of_week = extract(dow from p_date)::smallint
        and w.is_active
        and not exists (
          select 1
          from public.schedule_exceptions e
          where e.doctor_id = p_doctor_id and e.exception_date = p_date
        )

      union all

      select m.start_time, m.end_time
      from public.manual_availability m
      where m.doctor_id = p_doctor_id and m.availability_date = p_date
    ) as windows
    where windows.start_time <= p_start and windows.end_time >= p_end
  ) into v_ok;

  return v_ok;
end;
$$;

create or replace function public.create_appointment(
  p_doctor_id uuid,
  p_date date,
  p_start time,
  p_patient_name text,
  p_patient_phone text
)
returns public.appointments
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_clinic_id uuid;
  v_duration integer;
  v_end time;
  v_reference text;
  v_token text;
  v_result public.appointments;
begin
  if p_patient_name is null or length(btrim(p_patient_name)) not between 3 and 100 then
    raise exception 'Patient name must be between 3 and 100 characters';
  end if;
  if p_patient_phone is null or length(btrim(p_patient_phone)) not between 7 and 20 then
    raise exception 'Patient phone must be between 7 and 20 characters';
  end if;

  select d.clinic_id, d.slot_duration_minutes
  into v_clinic_id, v_duration
  from public.doctors d
  join public.clinics c on c.id = d.clinic_id
  where d.id = p_doctor_id and d.is_active and c.is_active;

  if not found then
    raise exception 'Doctor is not available for booking';
  end if;

  v_end := p_start + make_interval(mins => v_duration);
  if v_end <= p_start then
    raise exception 'Invalid slot time';
  end if;

  if not public.is_slot_available(p_doctor_id, p_date, p_start, v_end) then
    raise exception 'Slot is not available';
  end if;

  loop
    v_reference := 'DR-' || upper(encode(gen_random_bytes(3), 'hex'));
    exit when not exists (
      select 1 from public.appointments where reference_number = v_reference
    );
  end loop;
  v_token := encode(gen_random_bytes(24), 'hex');

  insert into public.appointments (
    reference_number, qr_token, doctor_id, clinic_id, patient_name, patient_phone,
    appointment_date, start_time, end_time, status
  )
  values (
    v_reference, v_token, p_doctor_id, v_clinic_id, btrim(p_patient_name), btrim(p_patient_phone),
    p_date, p_start, v_end, 'CONFIRMED'
  )
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_date date,
  p_start time
)
returns public.appointments
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_booking public.appointments;
  v_duration integer;
  v_end time;
  v_result public.appointments;
begin
  select * into v_booking
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;
  if v_booking.status not in ('CONFIRMED', 'CHECKED_IN') then
    raise exception 'Booking cannot be rescheduled';
  end if;

  select d.slot_duration_minutes into v_duration
  from public.doctors d
  join public.clinics c on c.id = d.clinic_id
  where d.id = v_booking.doctor_id and d.is_active and c.is_active;

  if not found then
    raise exception 'Doctor is not available for booking';
  end if;

  v_end := p_start + make_interval(mins => v_duration);
  if v_end <= p_start then
    raise exception 'Invalid slot time';
  end if;
  if not public.is_slot_available(v_booking.doctor_id, p_date, p_start, v_end) then
    raise exception 'Slot is not available';
  end if;

  update public.appointments
  set appointment_date = p_date, start_time = p_start, end_time = v_end, updated_at = now()
  where id = p_appointment_id
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.cancel_appointment(p_appointment_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_status text;
  v_result public.appointments;
begin
  select status into v_status
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;
  if v_status not in ('CONFIRMED', 'CHECKED_IN') then
    raise exception 'Booking cannot be cancelled';
  end if;

  update public.appointments
  set status = 'CANCELLED', updated_at = now()
  where id = p_appointment_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.is_slot_available(uuid, date, time, time) from public;
revoke all on function public.create_appointment(uuid, date, time, text, text) from public;
revoke all on function public.reschedule_appointment(uuid, date, time) from public;
revoke all on function public.cancel_appointment(uuid) from public;

grant execute on function public.is_slot_available(uuid, date, time, time) to anon, authenticated;
grant execute on function public.create_appointment(uuid, date, time, text, text) to anon, authenticated;
grant execute on function public.reschedule_appointment(uuid, date, time) to anon, authenticated;
grant execute on function public.cancel_appointment(uuid) to anon, authenticated;
