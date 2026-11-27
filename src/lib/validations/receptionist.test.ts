import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseReceptionistAppointmentsFilter,
  parseReceptionistLookupQuery,
  parseReceptionistQrToken,
  parseReceptionistReferenceParam,
  parseReceptionistStatusUpdateInput,
  parseScannedOrTypedBookingCode,
} from "./receptionist";

describe("receptionist validation helpers", () => {
  it("normalizes and validates booking references including lowercase and Arabic digits", () => {
    assert.deepEqual(parseReceptionistReferenceParam(" dr-8k2٩p٤ "), {
      success: true,
      reference: "DR-8K29P4",
    });

    const bad = parseReceptionistReferenceParam("ABC-123");
    assert.equal(bad.success, false);

    const nonString = parseReceptionistReferenceParam(null);
    assert.equal(nonString.success, false);
  });

  it("validates QR tokens and rejects short or malformed tokens", () => {
    const validToken = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718";
    assert.deepEqual(parseReceptionistQrToken(` ${validToken} `), {
      success: true,
      qrToken: validToken,
    });

    assert.equal(parseReceptionistQrToken("short").success, false);
    assert.equal(parseReceptionistQrToken("bad token with spaces!").success, false);
    assert.equal(parseReceptionistQrToken(123).success, false);
  });

  it("classifies manually typed references, QR tokens, and QR URLs cleanly", () => {
    assert.deepEqual(parseScannedOrTypedBookingCode("dr-8k29p4"), {
      type: "reference",
      value: "DR-8K29P4",
    });

    const hexToken = "deadbeef0123456789abcdef0123456789abcdef01234567";
    assert.deepEqual(parseScannedOrTypedBookingCode(hexToken), {
      type: "qrToken",
      value: hexToken,
    });

    assert.deepEqual(
      parseScannedOrTypedBookingCode(
        `https://example.com/receptionist/check-in?qrToken=${hexToken}`,
      ),
      {
        type: "qrToken",
        value: hexToken,
      },
    );

    assert.deepEqual(
      parseScannedOrTypedBookingCode(
        "https://example.com/receptionist/check-in?reference=dr-1a2b3c",
      ),
      {
        type: "reference",
        value: "DR-1A2B3C",
      },
    );

    assert.equal(parseScannedOrTypedBookingCode("   ").type, "invalid");
    assert.equal(parseScannedOrTypedBookingCode("???").type, "invalid");
  });

  it("validates lookup query parameters mutually exclusively", () => {
    const byRef = parseReceptionistLookupQuery(
      new URLSearchParams("reference=dr-8k29p4"),
    );
    assert.deepEqual(byRef, {
      success: true,
      data: { type: "reference", reference: "DR-8K29P4" },
    });

    const hexToken = "0123456789abcdef0123456789abcdef0123456789abcdef";
    const byQr = parseReceptionistLookupQuery(
      new URLSearchParams(`qrToken=${hexToken}`),
    );
    assert.deepEqual(byQr, {
      success: true,
      data: { type: "qrToken", qrToken: hexToken },
    });

    const missing = parseReceptionistLookupQuery(new URLSearchParams());
    assert.equal(missing.success, false);

    const both = parseReceptionistLookupQuery(
      new URLSearchParams(`reference=DR-8K29P4&qrToken=${hexToken}`),
    );
    assert.equal(both.success, false);
  });

  it("validates receptionist appointment filters", () => {
    const doctorId = "33000000-0000-0000-0000-000000000001";
    const clinicId = "11000000-0000-0000-0000-000000000001";
    const valid = parseReceptionistAppointmentsFilter(
      new URLSearchParams(
        `clinicId=${clinicId}&doctorId=${doctorId}&status=CONFIRMED&date=2026-12-06&query=DR-8K29P4`,
      ),
    );
    assert.deepEqual(valid, {
      success: true,
      data: {
        clinicId,
        doctorId,
        status: "CONFIRMED",
        date: "2026-12-06",
        query: "DR-8K29P4",
      },
    });

    const invalidStatus = parseReceptionistAppointmentsFilter(
      new URLSearchParams("status=UNKNOWN"),
    );
    assert.equal(invalidStatus.success, false);
    if (!invalidStatus.success) {
      assert.ok(invalidStatus.fieldErrors.status);
    }

    const invalidDate = parseReceptionistAppointmentsFilter(
      new URLSearchParams("date=2026-02-30"),
    );
    assert.equal(invalidDate.success, false);
    if (!invalidDate.success) {
      assert.ok(invalidDate.fieldErrors.date);
    }
  });

  it("validates status transition payloads", () => {
    assert.deepEqual(
      parseReceptionistStatusUpdateInput({ status: "CHECKED_IN" }),
      {
        success: true,
        data: { status: "CHECKED_IN" },
      },
    );
    assert.deepEqual(
      parseReceptionistStatusUpdateInput({ status: "COMPLETED" }),
      {
        success: true,
        data: { status: "COMPLETED" },
      },
    );
    assert.deepEqual(parseReceptionistStatusUpdateInput({ status: "NO_SHOW" }), {
      success: true,
      data: { status: "NO_SHOW" },
    });

    assert.equal(
      parseReceptionistStatusUpdateInput({ status: "CANCELLED" }).success,
      false,
    );
    assert.equal(parseReceptionistStatusUpdateInput(null).success, false);
  });
});
