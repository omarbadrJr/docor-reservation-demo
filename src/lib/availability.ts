import type { TimeWindow, WorkingWindowSource } from "@/types/availability";

import { dayOfWeek } from "./cairo-time";

function trimTime(value: string): string {
  return value.slice(0, 5);
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
