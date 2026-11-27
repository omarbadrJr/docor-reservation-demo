import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dayOfWeek, getCairoNow, listDatesInMonth, shiftMonth } from "./cairo-time";

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

  it("handles winter UTC+2 midnight rollover with 00:00 (never 24:00)", () => {
    assert.deepEqual(getCairoNow(new Date("2026-01-15T21:59:59Z")), {
      date: "2026-01-15",
      time: "23:59",
    });
    const midnight = getCairoNow(new Date("2026-01-15T22:00:00Z"));
    assert.deepEqual(midnight, {
      date: "2026-01-16",
      time: "00:00",
    });
    assert.notEqual(midnight.time, "24:00");
  });

  it("handles summer DST UTC+3 midnight rollover with 00:00 (never 24:00)", () => {
    assert.deepEqual(getCairoNow(new Date("2026-07-15T20:59:59Z")), {
      date: "2026-07-15",
      time: "23:59",
    });
    const midnight = getCairoNow(new Date("2026-07-15T21:00:00Z"));
    assert.deepEqual(midnight, {
      date: "2026-07-16",
      time: "00:00",
    });
    assert.notEqual(midnight.time, "24:00");
  });

  it("handles Egypt DST spring-forward transition in April (00:00 jumps to 01:00)", () => {
    assert.deepEqual(getCairoNow(new Date("2026-04-23T21:59:00Z")), {
      date: "2026-04-23",
      time: "23:59",
    });
    assert.deepEqual(getCairoNow(new Date("2026-04-23T22:00:00Z")), {
      date: "2026-04-24",
      time: "01:00",
    });
  });

  it("handles Egypt DST fall-back transition in October (24:00 EEST reverts to 23:00 EET)", () => {
    assert.deepEqual(getCairoNow(new Date("2026-10-29T20:59:00Z")), {
      date: "2026-10-29",
      time: "23:59",
    });
    assert.deepEqual(getCairoNow(new Date("2026-10-29T21:00:00Z")), {
      date: "2026-10-29",
      time: "23:00",
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

describe("shiftMonth", () => {
  it("keeps the same month when delta is zero", () => {
    assert.equal(shiftMonth("2026-11", 0), "2026-11");
  });

  it("shifts forward and backward within the same year", () => {
    assert.equal(shiftMonth("2026-06", 2), "2026-08");
    assert.equal(shiftMonth("2026-06", -2), "2026-04");
  });

  it("crosses single-month year boundaries cleanly", () => {
    assert.equal(shiftMonth("2026-12", 1), "2027-01");
    assert.equal(shiftMonth("2026-01", -1), "2025-12");
  });

  it("handles multi-month positive and negative deltas across years", () => {
    assert.equal(shiftMonth("2026-11", 14), "2028-01");
    assert.equal(shiftMonth("2026-02", -15), "2024-11");
    assert.equal(shiftMonth("2026-01", -24), "2024-01");
  });
});
