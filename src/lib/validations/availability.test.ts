import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseAvailabilityDate, parseMonth } from "./availability";

describe("parseMonth", () => {
  it("accepts a well-formed month", () => {
    assert.equal(parseMonth("2026-11"), "2026-11");
    assert.equal(parseMonth("2026-01"), "2026-01");
  });

  it("rejects missing or malformed values", () => {
    assert.equal(parseMonth(null), null);
    assert.equal(parseMonth(""), null);
    assert.equal(parseMonth("2026-1"), null);
    assert.equal(parseMonth("2026-13"), null);
    assert.equal(parseMonth("26-11"), null);
    assert.equal(parseMonth("2026-11-01"), null);
  });
});

describe("parseAvailabilityDate", () => {
  it("accepts real calendar dates", () => {
    assert.equal(parseAvailabilityDate("2026-11-26"), "2026-11-26");
    assert.equal(parseAvailabilityDate("2024-02-29"), "2024-02-29");
  });

  it("rejects missing, malformed, and impossible dates", () => {
    assert.equal(parseAvailabilityDate(null), null);
    assert.equal(parseAvailabilityDate("2026-11"), null);
    assert.equal(parseAvailabilityDate("2026-11-31"), null);
    assert.equal(parseAvailabilityDate("2026-02-31"), null);
    assert.equal(parseAvailabilityDate("2025-02-29"), null);
    assert.equal(parseAvailabilityDate("26-11-26"), null);
  });
});
