import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseSpecialtyId } from "./catalog";

const VALID_ID = "22000000-0000-0000-0000-000000000001";

describe("parseSpecialtyId", () => {
  it("returns a valid uuid string unchanged", () => {
    assert.equal(parseSpecialtyId(VALID_ID), VALID_ID);
  });

  it("returns null for a malformed id", () => {
    assert.equal(parseSpecialtyId("not-a-uuid"), null);
  });

  it("returns null for repeated query parameters", () => {
    assert.equal(parseSpecialtyId([VALID_ID, VALID_ID]), null);
  });
});
