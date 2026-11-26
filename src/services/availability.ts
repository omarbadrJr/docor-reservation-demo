import type {
  AvailableDate,
  DoctorAvailability,
  WorkingWindowSource,
} from "@/types/availability";

import {
  classifyAvailability,
  filterBookedSlots,
  generateSlots,
  resolveWorkingWindows,
} from "@/lib/availability";
import { getCairoNow, listDatesInMonth, type CairoNow } from "@/lib/cairo-time";

import { getActiveClinic } from "./clinics";
import { getActiveSpecialty, type CatalogClient } from "./specialties";

const ACTIVE_APPOINTMENT_STATUSES = ["CONFIRMED", "CHECKED_IN"] as const;

type ActiveDoctor = {
  id: string;
  clinic_id: string;
  specialty_id: string;
  slot_duration_minutes: number;
};

async function getActiveDoctor(
  client: CatalogClient,
  doctorId: string,
): Promise<ActiveDoctor | null> {
  const { data, error } = await client
    .from("doctors")
    .select("id, clinic_id, specialty_id, slot_duration_minutes")
    .eq("id", doctorId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error("مش قادرين نجيب مواعيد الدكتور دلوقتي، حاول تاني بعد شوية.");
  }

  return data ?? null;
}

async function loadScheduleWindows(
  client: CatalogClient,
  doctorId: string,
  startDate: string,
  endDate: string,
): Promise<WorkingWindowSource> {
  const [weekly, manual, exceptions] = await Promise.all([
    client
      .from("weekly_schedules")
      .select("day_of_week, start_time, end_time, is_active")
      .eq("doctor_id", doctorId)
      .eq("is_active", true),
    client
      .from("manual_availability")
      .select("availability_date, start_time, end_time")
      .eq("doctor_id", doctorId)
      .gte("availability_date", startDate)
      .lte("availability_date", endDate),
    client
      .from("schedule_exceptions")
      .select("exception_date, exception_type, start_time, end_time")
      .eq("doctor_id", doctorId)
      .gte("exception_date", startDate)
      .lte("exception_date", endDate),
  ]);

  if (weekly.error || manual.error || exceptions.error) {
    throw new Error("مش قادرين نجيب مواعيد الدكتور دلوقتي، حاول تاني بعد شوية.");
  }

  return {
    weekly: weekly.data ?? [],
    manual: manual.data ?? [],
    exceptions: exceptions.data ?? [],
  };
}

async function loadActiveAppointments(
  client: CatalogClient,
  doctorId: string,
  startDate: string,
  endDate: string,
) {
  const { data, error } = await client
    .from("appointments")
    .select("appointment_date, start_time, end_time")
    .eq("doctor_id", doctorId)
    .in("status", [...ACTIVE_APPOINTMENT_STATUSES])
    .gte("appointment_date", startDate)
    .lte("appointment_date", endDate);

  if (error) {
    throw new Error("مش قادرين نجيب المواعيد المحجوزة دلوقتي، حاول تاني بعد شوية.");
  }

  return data ?? [];
}

async function getAvailabilityContext(
  client: CatalogClient,
  doctorId: string,
  startDate: string,
  endDate: string,
) {
  const doctor = await getActiveDoctor(client, doctorId);
  if (!doctor) {
    return null;
  }

  const [clinic, specialty] = await Promise.all([
    getActiveClinic(client, doctor.clinic_id),
    getActiveSpecialty(client, doctor.specialty_id),
  ]);
  if (!clinic || !specialty) {
    return null;
  }

  const [source, appointments] = await Promise.all([
    loadScheduleWindows(client, doctorId, startDate, endDate),
    loadActiveAppointments(client, doctorId, startDate, endDate),
  ]);

  return { doctor, source, appointments };
}

export async function getDoctorAvailability(
  client: CatalogClient,
  doctorId: string,
  date: string,
  now: CairoNow = getCairoNow(),
): Promise<DoctorAvailability | null> {
  const context = await getAvailabilityContext(
    client,
    doctorId,
    date,
    date,
  );
  if (!context) {
    return null;
  }

  const windows = resolveWorkingWindows(date, context.source);
  const slots = filterBookedSlots(
    generateSlots(
      windows,
      context.doctor.slot_duration_minutes,
      date,
      now,
    ),
    context.appointments,
    date,
  );

  return {
    date,
    state: classifyAvailability(windows, slots),
    slots,
  };
}

export async function listDoctorAvailableDates(
  client: CatalogClient,
  doctorId: string,
  month: string,
  now: CairoNow = getCairoNow(),
): Promise<AvailableDate[] | null> {
  const dates = listDatesInMonth(month);
  if (dates.length === 0) {
    return [];
  }

  const context = await getAvailabilityContext(
    client,
    doctorId,
    dates[0],
    dates[dates.length - 1],
  );
  if (!context) {
    return null;
  }

  return dates.map((date) => {
    const windows = resolveWorkingWindows(date, context.source);
    const slots = filterBookedSlots(
      generateSlots(
        windows,
        context.doctor.slot_duration_minutes,
        date,
        now,
      ),
      context.appointments,
      date,
    );

    return { date, state: classifyAvailability(windows, slots) };
  });
}
