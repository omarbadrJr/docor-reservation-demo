import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkingWindowSource } from "@/types/availability";

import { resolveWorkingWindows } from "./availability";

const weekly = (
  dayOfWeek: number,
  start: string,
  end: string,
  isActive = true,
) => ({
  day_of_week: dayOfWeek,
  start_time: start,
  end_time: end,
  is_active: isActive,
});

const manual = (date: string, start: string, end: string) => ({
  availability_date: date,
  start_time: start,
  end_time: end,
});

const exception = (
  date: string,
  type: "CLOSED" | "MODIFIED_HOURS" | "EXTRA_HOURS",
  start: string | null = null,
  end: string | null = null,
) => ({
  exception_date: date,
  exception_type: type,
  start_time: start,
  end_time: end,
});

const source = (overrides: Partial<WorkingWindowSource>): WorkingWindowSource => ({
  weekly: [],
  manual: [],
  exceptions: [],
  ...overrides,
});

describe("resolveWorkingWindows", () => {
  it("returns active weekly windows for the matching weekday, sorted by start", () => {
    const result = resolveWorkingWindows(
      "2026-11-01",
      source({
        weekly: [
          weekly(0, "13:00:00", "17:00:00"),
          weekly(0, "09:00:00", "12:00:00"),
          weekly(1, "09:00:00", "17:00:00"),
          weekly(0, "18:00:00", "20:00:00", false),
        ],
      }),
    );

    assert.deepEqual(result, [
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "17:00" },
    ]);
  });

  it("blocks weekly windows on a CLOSED day but still adds manual availability", () => {
    const result = resolveWorkingWindows(
      "2026-11-01",
      source({
        weekly: [weekly(0, "09:00:00", "17:00:00")],
        exceptions: [exception("2026-11-01", "CLOSED")],
        manual: [manual("2026-11-01", "18:00:00", "20:00:00")],
      }),
    );

    assert.deepEqual(result, [{ start: "18:00", end: "20:00" }]);
  });

  it("replaces weekly windows with MODIFIED_HOURS", () => {
    const result = resolveWorkingWindows(
      "2026-11-01",
      source({
        weekly: [weekly(0, "09:00:00", "17:00:00")],
        exceptions: [exception("2026-11-01", "MODIFIED_HOURS", "11:00:00", "15:00:00")],
      }),
    );

    assert.deepEqual(result, [{ start: "11:00", end: "15:00" }]);
  });

  it("treats EXTRA_HOURS as a replacement and adds manual windows", () => {
    const result = resolveWorkingWindows(
      "2026-11-01",
      source({
        weekly: [weekly(0, "09:00:00", "17:00:00")],
        exceptions: [exception("2026-11-01", "EXTRA_HOURS", "19:00:00", "21:00:00")],
        manual: [manual("2026-11-01", "18:00:00", "18:30:00")],
      }),
    );

    assert.deepEqual(result, [
      { start: "18:00", end: "18:30" },
      { start: "19:00", end: "21:00" },
    ]);
  });

  it("returns no windows when the doctor does not work that day", () => {
    assert.deepEqual(
      resolveWorkingWindows(
        "2026-11-01",
        source({ weekly: [weekly(1, "09:00:00", "17:00:00")] }),
      ),
      [],
    );
  });
});
