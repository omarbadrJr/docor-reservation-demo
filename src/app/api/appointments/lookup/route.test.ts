import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CatalogClient } from "@/services/specialties";

import { handleLookupGet } from "../_shared";
import { GET } from "./route";

const DOCTOR_ID = "33000000-0000-0000-0000-000000000001";
const CLINIC_ID = "11000000-0000-0000-0000-000000000001";
const SPECIALTY_ID = "22000000-0000-0000-0000-000000000001";

function createFakeLookupClient(appointments: Record<string, unknown>[]) {
  const dataset = {
    appointments,
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
  } as unknown as CatalogClient;
}

describe("GET /api/appointments/lookup", () => {
  it("returns 400 VALIDATION_ERROR when query params are missing or invalid", async () => {
    const missing = await GET(
      new Request("http://localhost/api/appointments/lookup"),
    );
    assert.equal(missing.status, 400);
    assert.deepEqual(await missing.json(), {
      error: "اكتب رقم الحجز أو رقم الموبايل عشان ندور عليه.",
      code: "VALIDATION_ERROR",
      fieldErrors: {},
    });

    const badRef = await GET(
      new Request("http://localhost/api/appointments/lookup?reference=BAD"),
    );
    assert.equal(badRef.status, 400);
    assert.deepEqual(await badRef.json(), {
      error: "اكتب رقم الحجز صح (مثلاً DR-8K29P4).",
      code: "VALIDATION_ERROR",
      fieldErrors: { reference: "اكتب رقم الحجز صح (مثلاً DR-8K29P4)." },
    });

    const badPhone = await GET(
      new Request("http://localhost/api/appointments/lookup?phone=123"),
    );
    assert.equal(badPhone.status, 400);
    assert.deepEqual(await badPhone.json(), {
      error: "اكتب رقم موبايل صح (أرقام بس، من 7 لـ 20 رقم).",
      code: "VALIDATION_ERROR",
      fieldErrors: {
        phone: "اكتب رقم موبايل صح (أرقام بس، من 7 لـ 20 رقم).",
      },
    });
  });

  it("returns 200 with matching booking for reference and multiple bookings for phone", async () => {
    const client = createFakeLookupClient([
      {
        id: "44000000-0000-0000-0000-000000000001",
        reference_number: "DR-8K29P4",
        qr_token: "token-1",
        doctor_id: DOCTOR_ID,
        clinic_id: CLINIC_ID,
        patient_name: "سارة محمود",
        patient_phone: "01012345678",
        appointment_date: "2099-05-03",
        start_time: "09:00:00",
        end_time: "09:30:00",
        status: "CONFIRMED",
      },
      {
        id: "44000000-0000-0000-0000-000000000002",
        reference_number: "DR-9M12X7",
        qr_token: "token-2",
        doctor_id: DOCTOR_ID,
        clinic_id: CLINIC_ID,
        patient_name: "سارة محمود",
        patient_phone: "01012345678",
        appointment_date: "2099-05-05",
        start_time: "10:00:00",
        end_time: "10:30:00",
        status: "CONFIRMED",
      },
    ]);

    const byRef = await handleLookupGet(
      new Request("http://localhost/api/appointments/lookup?reference=dr-8k29p4"),
      () => client,
    );
    assert.equal(byRef.status, 200);
    const byRefJson = (await byRef.json()) as {
      bookings: Array<{ referenceNumber: string; qr_token?: string }>;
      todayDate: string;
    };
    assert.equal(byRefJson.bookings.length, 1);
    assert.equal(byRefJson.bookings[0].referenceNumber, "DR-8K29P4");
    assert.equal(byRefJson.bookings[0].qr_token, undefined);
    assert.match(byRefJson.todayDate, /^\d{4}-\d{2}-\d{2}$/);

    const byPhone = await handleLookupGet(
      new Request("http://localhost/api/appointments/lookup?phone=01012345678"),
      () => client,
    );
    assert.equal(byPhone.status, 200);
    const byPhoneJson = (await byPhone.json()) as {
      bookings: Array<{ referenceNumber: string }>;
    };
    assert.equal(byPhoneJson.bookings.length, 2);

    const empty = await handleLookupGet(
      new Request("http://localhost/api/appointments/lookup?reference=DR-000000"),
      () => client,
    );
    assert.equal(empty.status, 200);
    const emptyJson = (await empty.json()) as { bookings: unknown[] };
    assert.deepEqual(emptyJson.bookings, []);
  });

  it("returns 500 INTERNAL_ERROR when database query fails", async () => {
    const failingClient = {
      from() {
        const builder: Record<string, unknown> = {
          select: () => builder,
          eq: () => builder,
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve({ data: null, error: { message: "boom" } }).then(
              resolve,
            ),
        };
        return builder;
      },
    } as unknown as CatalogClient;

    const response = await handleLookupGet(
      new Request("http://localhost/api/appointments/lookup?reference=DR-8K29P4"),
      () => failingClient,
    );
    assert.equal(response.status, 500);
    const json = (await response.json()) as { code: string };
    assert.equal(json.code, "INTERNAL_ERROR");
  });
});
