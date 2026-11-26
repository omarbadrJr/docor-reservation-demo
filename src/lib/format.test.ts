import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatArabicDate,
  formatArabicMonth,
  formatConsultationFee,
  formatExperienceYears,
} from "./format";

describe("formatConsultationFee", () => {
  it("renders a numeric string as Egyptian pounds", () => {
    assert.equal(formatConsultationFee("150.00"), "150 جنيه");
  });

  it("keeps fractional amounts readable", () => {
    assert.equal(formatConsultationFee("12.5"), "12.5 جنيه");
  });
});

describe("formatExperienceYears", () => {
  it("returns null when experience is unknown", () => {
    assert.equal(formatExperienceYears(null), null);
  });

  it("returns an Arabic label for a known value", () => {
    assert.equal(formatExperienceYears(7), "7 سنين خبرة");
  });
});

describe("formatArabicDate", () => {
  it("formats a full date with Egyptian Arabic weekday and month names and ASCII digits", () => {
    assert.equal(formatArabicDate("2026-11-26"), "الخميس، 26 نوفمبر 2026");
  });

  it("strips leading zeros from single-digit days", () => {
    assert.equal(formatArabicDate("2026-11-01"), "الأحد، 1 نوفمبر 2026");
    assert.equal(formatArabicDate("2026-01-03"), "السبت، 3 يناير 2026");
  });

  it("handles leap days and end-of-year dates deterministically", () => {
    assert.equal(formatArabicDate("2024-02-29"), "الخميس، 29 فبراير 2024");
    assert.equal(formatArabicDate("2026-12-25"), "الجمعة، 25 ديسمبر 2026");
  });
});

describe("formatArabicMonth", () => {
  it("formats YYYY-MM strings with Arabic month names and ASCII year digits", () => {
    assert.equal(formatArabicMonth("2026-11"), "نوفمبر 2026");
    assert.equal(formatArabicMonth("2026-01"), "يناير 2026");
    assert.equal(formatArabicMonth("2026-04"), "أبريل 2026");
    assert.equal(formatArabicMonth("2026-12"), "ديسمبر 2026");
  });
});
