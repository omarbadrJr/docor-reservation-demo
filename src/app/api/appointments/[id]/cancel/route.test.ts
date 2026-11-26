import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CatalogClient } from "@/services/specialties";

import { handleCancelPatch } from "../../_shared";
import { PATCH } from "./route";

const APPOINTMENT_ID = "44000000-0000-0000-0000-000000000001";
const DOCTOR_ID = "33000000-0000-0000-0000-000000000001";
const CLINIC_ID = "11000000-0000-0000-0000-000000000001";
const SPECIALTY_ID = "22000000-0000-0000-0000-000000000001";

function createFakeCancelClient(status = "CONFIRMED") {
  const dataset = {
    doctors: [
      {
        id: DOCTOR_ID,
        clinic_id: CLINIC_ID,
        specialty_id: SPECIALTY_ID,
        full_name: "د. أحمد مصطفى",
        consultation_fee: "150.00",
        is_active: true,
      },
    ],
    clinics: [
      {
        id: CLINIC_ID,
        name: "عيادة النيل",
        address: "شارع النيل، الدنجاوة، البحيرة",
        is_active: true,
      },
    ],
    specialties: [
      {
        id: SPECIALTY_ID,
        name: "باطنة",
        is_active: true,
      },
    ],
    appointments: [
      {
        id: APPOINTMENT_ID,
        reference_number: "DR-8K29P4",
        qr_token: "token-1",
        doctor_id: DOCTOR_ID,
        clinic_id: CLINIC_ID,
        patient_name: "سارة محمود",
        patient_phone: "01012345678",
        appointment_date: "2099-05-03",
        start_time: "09:00:00",
        end_time: "09:30:00",
        status,
      },
    ],
  };

  return {
    from(table: keyof typeof dataset) {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      const result = () =>
        (dataset[table] ?? []).filter((row) => filters.every((f) => f(row)));

      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (key: string, value: unknown) => {
          filters.push((row) => row[key] === value);
          return builder;
        },
        in: (key: string, values: unknown[]) => {
          filters.push((row) => values.includes(row[key]));
          return builder;
        },
        maybeSingle: async () => ({ data: result()[0] ?? null, error: null }),
        then: (
          resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown,
        ) =>
          Promise.resolve({ data: result(), error: null }).then(
            resolve,
            reject,
          ),
      };
      return builder;
    },
    async rpc() {
      return {
        data: {
          ...dataset.appointments[0],
          status: "CANCELLED",
        },
        error: null,
      };
    },
  } as unknown as CatalogClient;
}

describe("PATCH /api/appointments/[id]/cancel", () => {
  it("returns 400 VALIDATION_ERROR for malformed JSON and invalid inputs", async () => {
    const malformed = await PATCH(
      new Request(`http://localhost/api/appointments/${APPOINTMENT_ID}/cancel`, {
        method: "PATCH",
        body: "{bad",
      }),
      { params: Promise.resolve({ id: APPOINTMENT_ID }) },
    );
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).code, "VALIDATION_ERROR");

    const invalid = await PATCH(
      new Request("http://localhost/api/appointments/bad-id/cancel", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          referenceNumber: "BAD",
          patientPhone: "123",
        }),
      }),
      { params: Promise.resolve({ id: "bad-id" }) },
    );
    assert.equal(invalid.status, 400);
    const json = (await invalid.json()) as {
      code: string;
      fieldErrors: Record<string, string>;
    };
    assert.equal(json.code, "VALIDATION_ERROR");
    assert.ok(json.fieldErrors.appointmentId);
    assert.ok(json.fieldErrors.referenceNumber);
    assert.ok(json.fieldErrors.patientPhone);
  });

  it("returns 200 with CANCELLED booking on valid cancel", async () => {
    const client = createFakeCancelClient("CONFIRMED");
    const response = await handleCancelPatch(
      new Request(`http://localhost/api/appointments/${APPOINTMENT_ID}/cancel`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          referenceNumber: "DR-8K29P4",
          patientPhone: "٠١٠١٢٣٤٥٦٧٨",
        }),
      }),
      APPOINTMENT_ID,
      () => client,
    );

    assert.equal(response.status, 200);
    const json = (await response.json()) as {
      booking: { status: string; canCancel: boolean; canReschedule: boolean };
    };
    assert.equal(json.booking.status, "CANCELLED");
    assert.equal(json.booking.canCancel, false);
    assert.equal(json.booking.canReschedule, false);
  });

  it("returns 404 BOOKING_NOT_FOUND and 409 BOOKING_NOT_MODIFIABLE when disallowed", async () => {
    const confirmedClient = createFakeCancelClient("CONFIRMED");
    const notFound = await handleCancelPatch(
      new Request(`http://localhost/api/appointments/${APPOINTMENT_ID}/cancel`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          referenceNumber: "DR-000000",
          patientPhone: "01012345678",
        }),
      }),
      APPOINTMENT_ID,
      () => confirmedClient,
    );
    assert.equal(notFound.status, 404);
    assert.equal((await notFound.json()).code, "BOOKING_NOT_FOUND");

    const checkedInClient = createFakeCancelClient("CHECKED_IN");
    const conflict = await handleCancelPatch(
      new Request(`http://localhost/api/appointments/${APPOINTMENT_ID}/cancel`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          referenceNumber: "DR-8K29P4",
          patientPhone: "01012345678",
        }),
      }),
      APPOINTMENT_ID,
      () => checkedInClient,
    );
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).code, "BOOKING_NOT_MODIFIABLE");
  });
});
