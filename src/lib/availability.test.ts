import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BookedWindow, WorkingWindowSource } from "@/types/availability";

import {
  classifyAvailability,
  filterBookedSlots,
  generateSlots,
  resolveWorkingWindows,
} from "./availability";

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

describe("generateSlots", () => {
  it("splits a window into aligned slots", () => {
    assert.deepEqual(
      generateSlots(
        [{ start: "09:00", end: "10:00" }],
        30,
        "2026-11-01",
        { date: "2026-11-01", time: "08:00" },
      ),
      [
        { start: "09:00", end: "09:30" },
        { start: "09:30", end: "10:00" },
      ],
    );
  });

  it("drops a trailing partial slot", () => {
    assert.deepEqual(
      generateSlots(
        [{ start: "09:00", end: "10:00" }],
        45,
        "2026-11-01",
        { date: "2026-11-01", time: "08:00" },
      ),
      [{ start: "09:00", end: "09:45" }],
    );
  });

  it("deduplicates slots produced by overlapping windows", () => {
    assert.deepEqual(
      generateSlots(
        [
          { start: "09:00", end: "10:00" },
          { start: "09:00", end: "09:30" },
        ],
        30,
        "2026-11-01",
        { date: "2026-11-01", time: "08:00" },
      ),
      [
        { start: "09:00", end: "09:30" },
        { start: "09:30", end: "10:00" },
      ],
    );
  });

  it("excludes past slots today and all slots on earlier dates", () => {
    const windows = [{ start: "09:00", end: "10:00" }];

    assert.deepEqual(
      generateSlots(windows, 30, "2026-11-01", {
        date: "2026-11-01",
        time: "09:15",
      }),
      [
        { start: "09:30", end: "10:00" },
      ],
    );
    assert.deepEqual(
      generateSlots(windows, 30, "2026-10-31", {
        date: "2026-11-01",
        time: "08:00",
      }),
      [],
    );
  });

  it("returns no slots for an invalid duration", () => {
    assert.deepEqual(
      generateSlots(
        [{ start: "09:00", end: "10:00" }],
        0,
        "2026-11-01",
        { date: "2026-11-01", time: "08:00" },
      ),
      [],
    );
  });
});

describe("filterBookedSlots", () => {
  const slots = [
    { start: "09:00", end: "09:30" },
    { start: "09:30", end: "10:00" },
  ];

  const appointment = (
    date: string,
    start: string,
    end: string,
  ): BookedWindow => ({
    appointment_date: date,
    start_time: start,
    end_time: end,
  });

  it("removes every slot that overlaps an active booking", () => {
    assert.deepEqual(
      filterBookedSlots(
        slots,
        [appointment("2026-11-01", "09:15:00", "09:45:00")],
        "2026-11-01",
      ),
      [],
    );
  });

  it("keeps adjacent slots and ignores bookings on other dates", () => {
    assert.deepEqual(
      filterBookedSlots(
        slots,
        [
          appointment("2026-11-01", "09:30:00", "10:00:00"),
          appointment("2026-11-02", "09:00:00", "09:30:00"),
        ],
        "2026-11-01",
      ),
      [{ start: "09:00", end: "09:30" }],
    );
  });
});

describe("classifyAvailability", () => {
  it("marks a day with no working windows as OFF", () => {
    assert.equal(classifyAvailability([], []), "OFF");
  });

  it("marks a working day with no free slots as FULL", () => {
    assert.equal(
      classifyAvailability([{ start: "09:00", end: "10:00" }], []),
      "FULL",
    );
  });

  it("marks a working day with free slots as AVAILABLE", () => {
    assert.equal(
      classifyAvailability(
        [{ start: "09:00", end: "10:00" }],
        [{ start: "09:00", end: "09:30" }],
      ),
      "AVAILABLE",
    );
  });
});
