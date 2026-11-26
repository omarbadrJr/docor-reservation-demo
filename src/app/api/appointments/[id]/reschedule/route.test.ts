import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CatalogClient } from "@/services/specialties";

import { handleReschedulePatch } from "../../_shared";
import { PATCH } from "./route";

const APPOINTMENT_ID = "44000000-0000-0000-0000-000000000001";
const DOCTOR_ID = "33000000-0000-0000-0000-000000000001";
const CLINIC_ID = "11000000-0000-0000-0000-000000000001";
const SPECIALTY_ID = "22000000-0000-0000-0000-000000000001";
const OLD_DATE = "2099-05-03";
const NEW_DATE = "2099-05-04";
const NEW_DAY = new Date(`${NEW_DATE}T00:00:00Z`).getUTCDay();

function createFakeRescheduleClient(options?: {
  status?: string;
  rpcError?: { code?: string; message?: string } | null;
}) {
  const dataset = {
    doctors: [
      {
        id: DOCTOR_ID,
        clinic_id: CLINIC_ID,
        specialty_id: SPECIALTY_ID,
        full_name: "د. أحمد مصطفى",
        photo_url: null,
        bio: null,
        qualifications: null,
        experience_years: null,
        consultation_fee: "150.00",
        slot_duration_minutes: 30,
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
        description: null,
        is_active: true,
      },
    ],
    weekly_schedules: [
      {
        doctor_id: DOCTOR_ID,
        day_of_week: NEW_DAY,
        start_time: "09:00:00",
        end_time: "10:00:00",
        is_active: true,
      },
    ],
    manual_availability: [],
    schedule_exceptions: [],
    appointments: [
      {
        id: APPOINTMENT_ID,
        reference_number: "DR-8K29P4",
        qr_token: "token-1",
        doctor_id: DOCTOR_ID,
        clinic_id: CLINIC_ID,
        patient_name: "سارة محمود",
        patient_phone: "01012345678",
        appointment_date: OLD_DATE,
        start_time: "09:00:00",
        end_time: "09:30:00",
        status: options?.status ?? "CONFIRMED",
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
        gte: (key: string, value: unknown) => {
          filters.push((row) => String(row[key]) >= String(value));
          return builder;
        },
        lte: (key: string, value: unknown) => {
          filters.push((row) => String(row[key]) <= String(value));
          return builder;
        },
        order: () => builder,
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
    async rpc(_fn: string, args: Record<string, unknown>) {
      if (options?.rpcError) {
        return { data: null, error: options.rpcError };
      }
      return {
        data: {
          ...dataset.appointments[0],
          appointment_date: args.p_date,
          start_time: `${String(args.p_start)}:00`,
          end_time: "10:00:00",
        },
        error: null,
      };
    },
  } as unknown as CatalogClient;
}

describe("PATCH /api/appointments/[id]/reschedule", () => {
  it("returns 400 VALIDATION_ERROR for malformed JSON and invalid route/body inputs", async () => {
    const malformed = await PATCH(
      new Request(`http://localhost/api/appointments/${APPOINTMENT_ID}/reschedule`, {
        method: "PATCH",
        body: "{bad",
      }),
      { params: Promise.resolve({ id: APPOINTMENT_ID }) },
    );
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).code, "VALIDATION_ERROR");

    const invalid = await PATCH(
      new Request("http://localhost/api/appointments/not-a-uuid/reschedule", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          referenceNumber: "BAD",
          patientPhone: "123",
          appointmentDate: "2026-02-31",
          startTime: "99:99",
        }),
      }),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );
    assert.equal(invalid.status, 400);
    const invalidJson = (await invalid.json()) as {
      code: string;
      fieldErrors: Record<string, string>;
    };
    assert.equal(invalidJson.code, "VALIDATION_ERROR");
    assert.ok(invalidJson.fieldErrors.appointmentId);
    assert.ok(invalidJson.fieldErrors.referenceNumber);
    assert.ok(invalidJson.fieldErrors.patientPhone);
    assert.ok(invalidJson.fieldErrors.appointmentDate);
    assert.ok(invalidJson.fieldErrors.startTime);
  });

  it("returns 200 with updated booking on valid reschedule", async () => {
    const client = createFakeRescheduleClient();
    const response = await handleReschedulePatch(
      new Request(`http://localhost/api/appointments/${APPOINTMENT_ID}/reschedule`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          referenceNumber: "dr-8k29p4",
          patientPhone: "01012345678",
          appointmentDate: NEW_DATE,
          startTime: "09:30",
        }),
      }),
      APPOINTMENT_ID,
      () => client,
    );

    assert.equal(response.status, 200);
    const json = (await response.json()) as {
      booking: { appointmentDate: string; startTime: string; status: string };
      todayDate: string;
    };
    assert.equal(json.booking.appointmentDate, NEW_DATE);
    assert.equal(json.booking.startTime, "09:30");
    assert.equal(json.booking.status, "CONFIRMED");
    assert.match(json.todayDate, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns 409 SLOT_UNAVAILABLE with refreshed availability on slot conflict", async () => {
    const client = createFakeRescheduleClient({
      rpcError: { code: "P0001", message: "Slot is not available" },
    });

    const response = await handleReschedulePatch(
      new Request(`http://localhost/api/appointments/${APPOINTMENT_ID}/reschedule`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          referenceNumber: "DR-8K29P4",
          patientPhone: "01012345678",
          appointmentDate: NEW_DATE,
          startTime: "09:30",
        }),
      }),
      APPOINTMENT_ID,
      () => client,
    );

    assert.equal(response.status, 409);
    const json = (await response.json()) as {
      code: string;
      availability?: { date: string; state: string; slots: unknown[] };
    };
    assert.equal(json.code, "SLOT_UNAVAILABLE");
    assert.equal(json.availability?.date, NEW_DATE);
    assert.equal(json.availability?.state, "AVAILABLE");
    assert.equal(json.availability?.slots.length, 2);
  });

  it("returns 404 BOOKING_NOT_FOUND and 409 BOOKING_NOT_MODIFIABLE when disallowed", async () => {
    const client = createFakeRescheduleClient({ status: "CANCELLED" });

    const notFound = await handleReschedulePatch(
      new Request(`http://localhost/api/appointments/${APPOINTMENT_ID}/reschedule`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          referenceNumber: "DR-000000",
          patientPhone: "01012345678",
          appointmentDate: NEW_DATE,
          startTime: "09:30",
        }),
      }),
      APPOINTMENT_ID,
      () => client,
    );
    assert.equal(notFound.status, 404);
    assert.equal((await notFound.json()).code, "BOOKING_NOT_FOUND");

    const cancelled = await handleReschedulePatch(
      new Request(`http://localhost/api/appointments/${APPOINTMENT_ID}/reschedule`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          referenceNumber: "DR-8K29P4",
          patientPhone: "01012345678",
          appointmentDate: NEW_DATE,
          startTime: "09:30",
        }),
      }),
      APPOINTMENT_ID,
      () => client,
    );
    assert.equal(cancelled.status, 409);
    assert.equal((await cancelled.json()).code, "BOOKING_NOT_MODIFIABLE");
  });
});
