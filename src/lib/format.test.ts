import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatConsultationFee, formatExperienceYears } from "./format";

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
