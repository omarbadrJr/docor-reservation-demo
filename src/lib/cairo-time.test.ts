import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dayOfWeek, getCairoNow, listDatesInMonth } from "./cairo-time";

describe("getCairoNow", () => {
  it("uses Cairo winter time (UTC+2)", () => {
    assert.deepEqual(getCairoNow(new Date("2026-01-15T22:30:00Z")), {
      date: "2026-01-16",
      time: "00:30",
    });
  });

  it("uses Cairo summer time (UTC+3)", () => {
    assert.deepEqual(getCairoNow(new Date("2026-07-15T21:30:00Z")), {
      date: "2026-07-16",
      time: "00:30",
    });
  });
});

describe("listDatesInMonth", () => {
  it("lists every date in a 30-day month", () => {
    const dates = listDatesInMonth("2026-11");

    assert.equal(dates.length, 30);
    assert.equal(dates[0], "2026-11-01");
    assert.equal(dates.at(-1), "2026-11-30");
  });

  it("handles February in a leap year", () => {
    assert.equal(listDatesInMonth("2024-02").length, 29);
  });
});

describe("dayOfWeek", () => {
  it("returns Sunday as 0 and Thursday as 4", () => {
    assert.equal(dayOfWeek("2026-11-01"), 0);
    assert.equal(dayOfWeek("2026-11-26"), 4);
  });
});
