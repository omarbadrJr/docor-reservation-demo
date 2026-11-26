import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { POST } from "./route";

const VALID_DOCTOR_ID = "22000000-0000-0000-0000-000000000001";

describe("POST /api/appointments", () => {
  it("returns 400 VALIDATION_ERROR for malformed JSON", async () => {
    const request = new Request("http://localhost/api/appointments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{bad-json",
    });

    const response = await POST(request);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "بيانات الحجز مش مظبوطة، راجعها وحاول تاني.",
      code: "VALIDATION_ERROR",
    });
  });

  it("returns 400 VALIDATION_ERROR with empty fieldErrors for non-object JSON", async () => {
    const request = new Request("http://localhost/api/appointments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([]),
    });

    const response = await POST(request);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "بيانات الحجز مش مظبوطة، راجعها وحاول تاني.",
      code: "VALIDATION_ERROR",
      fieldErrors: {},
    });
  });

  it("returns 400 VALIDATION_ERROR and Egyptian Arabic fieldError for a single invalid field", async () => {
    const shortNameResponse = await POST(
      new Request("http://localhost/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          doctorId: VALID_DOCTOR_ID,
          appointmentDate: "2026-11-26",
          startTime: "09:30",
          patientName: "أ",
          patientPhone: "01012345678",
        }),
      }),
    );

    assert.equal(shortNameResponse.status, 400);
    assert.deepEqual(await shortNameResponse.json(), {
      error: "اكتب اسمك بالكامل (3 حروف على الأقل).",
      code: "VALIDATION_ERROR",
      fieldErrors: {
        patientName: "اكتب اسمك بالكامل (3 حروف على الأقل).",
      },
    });

    const invalidPhoneResponse = await POST(
      new Request("http://localhost/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          doctorId: VALID_DOCTOR_ID,
          appointmentDate: "2026-11-26",
          startTime: "09:30",
          patientName: "سارة محمود",
          patientPhone: "123",
        }),
      }),
    );

    assert.equal(invalidPhoneResponse.status, 400);
    assert.deepEqual(await invalidPhoneResponse.json(), {
      error: "اكتب رقم موبايل صح (أرقام بس، من 7 لـ 20 رقم).",
      code: "VALIDATION_ERROR",
      fieldErrors: {
        patientPhone: "اكتب رقم موبايل صح (أرقام بس، من 7 لـ 20 رقم).",
      },
    });
  });

  it("returns 400 VALIDATION_ERROR with all fieldErrors when multiple fields fail", async () => {
    const response = await POST(
      new Request("http://localhost/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          doctorId: "bad",
          appointmentDate: "2026-02-31",
          startTime: "99:99",
          patientName: "أ".repeat(101),
          patientPhone: "abc",
        }),
      }),
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "بيانات الحجز مش مظبوطة، راجعها وحاول تاني.",
      code: "VALIDATION_ERROR",
      fieldErrors: {
        doctorId: "رقم الدكتور غير صحيح.",
        appointmentDate: "التاريخ غير صحيح.",
        startTime: "المعاد غير صحيح.",
        patientName: "الاسم طويل أوي، اختصره شوية.",
        patientPhone: "اكتب رقم موبايل صح (أرقام بس، من 7 لـ 20 رقم).",
      },
    });
  });
});
