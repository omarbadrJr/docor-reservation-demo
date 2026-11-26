import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatArabicTime, formatWorkingSchedule } from "./schedule";

describe("formatWorkingSchedule", () => {
  it("maps weekday numbers to Arabic labels and renders times in 12-hour Egyptian Arabic", () => {
    const result = formatWorkingSchedule([
      { day_of_week: 0, start_time: "09:00:00", end_time: "17:00:00" },
      { day_of_week: 5, start_time: "10:00", end_time: "14:00" },
    ]);

    assert.deepEqual(result, [
      "الأحد: 9:00 الصبح - 5:00 بالليل",
      "الجمعة: 10:00 الصبح - 2:00 بالليل",
    ]);
  });

  it("labels midnight as الصبح and noon as بالليل", () => {
    assert.deepEqual(
      formatWorkingSchedule([
        { day_of_week: 3, start_time: "00:00:00", end_time: "12:00:00" },
      ]),
      ["الأربعاء: 12:00 الصبح - 12:00 بالليل"],
    );
  });

  it("returns an empty array when there are no active days", () => {
    assert.deepEqual(formatWorkingSchedule([]), []);
  });
});

describe("formatArabicTime", () => {
  it("formats morning times from HH:MM and HH:MM:SS", () => {
    assert.equal(formatArabicTime("09:00"), "9:00 الصبح");
    assert.equal(formatArabicTime("09:00:00"), "9:00 الصبح");
  });

  it("formats afternoon and evening times as بالليل", () => {
    assert.equal(formatArabicTime("17:30"), "5:30 بالليل");
    assert.equal(formatArabicTime("23:45:00"), "11:45 بالليل");
  });

  it("formats midnight as 12 الصبح and noon as 12 بالليل", () => {
    assert.equal(formatArabicTime("00:00"), "12:00 الصبح");
    assert.equal(formatArabicTime("00:15:00"), "12:15 الصبح");
    assert.equal(formatArabicTime("12:00"), "12:00 بالليل");
    assert.equal(formatArabicTime("12:30"), "12:30 بالليل");
  });
});
