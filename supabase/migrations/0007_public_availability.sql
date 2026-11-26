-- Phase 5 / Task 4: public availability needs booked windows without exposing
-- appointment details. This function returns only dates and times for active
-- bookings and is safe to call with the public anon key.

create or replace function public.list_doctor_booked_windows(
  p_doctor_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  appointment_date date,
  start_time time,
  end_time time
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.appointment_date, a.start_time, a.end_time
  from public.appointments a
  where a.doctor_id = p_doctor_id
    and a.status in ('CONFIRMED', 'CHECKED_IN')
    and a.appointment_date between p_start_date and p_end_date
  order by a.appointment_date, a.start_time;
$$;

revoke all on function public.list_doctor_booked_windows(uuid, date, date) from public;
grant execute on function public.list_doctor_booked_windows(uuid, date, date) to anon, authenticated;
