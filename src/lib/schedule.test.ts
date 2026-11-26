import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatWorkingSchedule } from "./schedule";

describe("formatWorkingSchedule", () => {
  it("maps weekday numbers to Arabic labels and trims seconds", () => {
    const result = formatWorkingSchedule([
      { day_of_week: 0, start_time: "09:00:00", end_time: "17:00:00" },
      { day_of_week: 5, start_time: "10:00", end_time: "14:00" },
    ]);

    assert.deepEqual(result, [
      "الأحد: 09:00 - 17:00",
      "الجمعة: 10:00 - 14:00",
    ]);
  });

  it("returns an empty array when there are no active days", () => {
    assert.deepEqual(formatWorkingSchedule([]), []);
  });
});
