import type {
  AvailabilityDateState,
  BookedWindow,
  TimeSlot,
  TimeWindow,
  WorkingWindowSource,
} from "@/types/availability";

import { dayOfWeek, type CairoNow } from "./cairo-time";

function trimTime(value: string): string {
  return value.slice(0, 5);
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function resolveWorkingWindows(
  date: string,
  source: WorkingWindowSource,
): TimeWindow[] {
  const exceptions = source.exceptions.filter(
    (exception) => exception.exception_date === date,
  );
  const hasException = exceptions.length > 0;

  const weekly = hasException
    ? []
    : source.weekly
        .filter(
          (window) =>
            window.is_active && window.day_of_week === dayOfWeek(date),
        )
        .map((window) => ({
          start: trimTime(window.start_time),
          end: trimTime(window.end_time),
        }));

  const exceptionWindows = exceptions
    .filter((exception) => exception.exception_type !== "CLOSED")
    .map((exception) => ({
      start: trimTime(exception.start_time!),
      end: trimTime(exception.end_time!),
    }));

  const manual = source.manual
    .filter((window) => window.availability_date === date)
    .map((window) => ({
      start: trimTime(window.start_time),
      end: trimTime(window.end_time),
    }));

  return [...exceptionWindows, ...weekly, ...manual].sort(
    (first, second) =>
      first.start.localeCompare(second.start) ||
      first.end.localeCompare(second.end),
  );
}

export function generateSlots(
  windows: TimeWindow[],
  slotDurationMinutes: number,
  date: string,
  now: CairoNow,
): TimeSlot[] {
  if (!Number.isFinite(slotDurationMinutes) || slotDurationMinutes <= 0) {
    return [];
  }
  if (date < now.date) {
    return [];
  }

  const nowMinutes = timeToMinutes(now.time);
  const seen = new Set<string>();
  const slots: TimeSlot[] = [];

  for (const window of windows) {
    const windowStart = timeToMinutes(window.start);
    const windowEnd = timeToMinutes(window.end);

    for (
      let cursor = windowStart;
      cursor + slotDurationMinutes <= windowEnd;
      cursor += slotDurationMinutes
    ) {
      if (date === now.date && cursor <= nowMinutes) {
        continue;
      }

      const slot = {
        start: minutesToTime(cursor),
        end: minutesToTime(cursor + slotDurationMinutes),
      };
      const key = `${slot.start}-${slot.end}`;

      if (!seen.has(key)) {
        seen.add(key);
        slots.push(slot);
      }
    }
  }

  return slots.sort((first, second) => first.start.localeCompare(second.start));
}

export function filterBookedSlots(
  slots: TimeSlot[],
  appointments: BookedWindow[],
  date: string,
): TimeSlot[] {
  const booked = appointments
    .filter((appointment) => appointment.appointment_date === date)
    .map((appointment) => ({
      start: timeToMinutes(appointment.start_time),
      end: timeToMinutes(appointment.end_time),
    }));

  return slots.filter((slot) => {
    const start = timeToMinutes(slot.start);
    const end = timeToMinutes(slot.end);

    return !booked.some(
      (appointment) => start < appointment.end && end > appointment.start,
    );
  });
}

export function classifyAvailability(
  windows: TimeWindow[],
  slots: TimeSlot[],
): AvailabilityDateState {
  if (windows.length === 0) {
    return "OFF";
  }
  return slots.length === 0 ? "FULL" : "AVAILABLE";
}
