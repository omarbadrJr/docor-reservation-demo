import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatWorkingSchedule } from "./schedule";

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
