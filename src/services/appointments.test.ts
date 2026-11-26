import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Appointment, AppointmentStatus } from "@/types/database";

import { BookingServiceError, createAppointment } from "./appointments";

const DOCTOR_ID = "33000000-0000-0000-0000-000000000001";
const CLINIC_ID = "11000000-0000-0000-0000-000000000001";
const SPECIALTY_ID = "22000000-0000-0000-0000-000000000001";
const APPOINTMENT_DATE = "2099-05-03";
const APPOINTMENT_DAY = new Date(`${APPOINTMENT_DATE}T00:00:00Z`).getUTCDay();

type Dataset = {
  doctors: Record<string, unknown>[];
  clinics: Record<string, unknown>[];
  specialties: Record<string, unknown>[];
  weekly_schedules: Record<string, unknown>[];
  manual_availability: Record<string, unknown>[];
  schedule_exceptions: Record<string, unknown>[];
  appointments: Record<string, unknown>[];
};

type RpcCall = {
  fn: string;
  args: Record<string, unknown>;
};

type RpcResponse = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

type RpcHandler = (
  fn: string,
  args: Record<string, unknown>,
  attempt: number,
  dataset: Dataset,
) => Promise<RpcResponse> | RpcResponse;

const doctorRow = (isActive = true) => ({
  id: DOCTOR_ID,
  clinic_id: CLINIC_ID,
  specialty_id: SPECIALTY_ID,
  full_name: "د. أحمد عبد الرحمن",
  photo_url: null,
  bio: "استشاري الباطنة",
  qualifications: "دكتوراه الباطنة",
  experience_years: 12,
  consultation_fee: "250.00",
  slot_duration_minutes: 30,
  is_active: isActive,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

const clinicRow = (isActive = true) => ({
  id: CLINIC_ID,
  name: "عيادة النيل التخصصية",
  address: "شارع الجمهورية، دمنهور، البحيرة",
  phone: "0453311223",
  is_active: isActive,
});

const specialtyRow = (isActive = true) => ({
  id: SPECIALTY_ID,
  name: "باطنة",
  description: "أمراض الباطنة والجهاز الهضمي",
  is_active: isActive,
});

const appointmentRow = (
  overrides: Partial<Appointment> = {},
): Appointment => ({
  id: "44000000-0000-0000-0000-000000000001",
  reference_number: "DR-8K29P4",
  qr_token: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718",
  doctor_id: DOCTOR_ID,
  clinic_id: CLINIC_ID,
  patient_name: "سارة محمود علي",
  patient_phone: "01012345678",
  appointment_date: APPOINTMENT_DATE,
  start_time: "09:00:00",
  end_time: "09:30:00",
  status: "CONFIRMED" satisfies AppointmentStatus,
  created_at: "2026-11-26T08:00:00Z",
  updated_at: "2026-11-26T08:00:00Z",
  ...overrides,
});

function baseDataset(): Dataset {
  return {
    doctors: [doctorRow(true)],
    clinics: [clinicRow(true)],
    specialties: [specialtyRow(true)],
    weekly_schedules: [
      {
        doctor_id: DOCTOR_ID,
        day_of_week: APPOINTMENT_DAY,
        start_time: "09:00:00",
        end_time: "10:00:00",
        is_active: true,
      },
    ],
    manual_availability: [],
    schedule_exceptions: [],
    appointments: [],
  };
}

function fakeClient(dataset: Dataset, onRpc?: RpcHandler) {
  const rpcCalls: RpcCall[] = [];

  const client = {
    from(table: keyof Dataset) {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];

      const result = () =>
        (dataset[table] ?? []).filter((row) =>
          filters.every((filter) => filter(row)),
        );

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
        maybeSingle: async () => {
          const rows = result();
          return { data: rows[0] ?? null, error: null };
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
    async rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      if (!onRpc) {
        return { data: appointmentRow(), error: null };
      }
      return onRpc(fn, args, rpcCalls.length, dataset);
    },
  };

  return {
    client: client as unknown as Parameters<typeof createAppointment>[0],
    rpcCalls,
  };
}

const validInput = {
  doctorId: DOCTOR_ID,
  appointmentDate: APPOINTMENT_DATE,
  startTime: "09:00",
  patientName: "سارة محمود علي",
  patientPhone: "01012345678",
};

describe("createAppointment", () => {
  it("returns confirmed booking details, PNG QR data URL, and HH:MM times", async () => {
    const { client, rpcCalls } = fakeClient(baseDataset(), () => ({
      data: appointmentRow(),
      error: null,
    }));

    const booking = await createAppointment(client, validInput);

    assert.equal(rpcCalls.length, 1);
    assert.deepEqual(rpcCalls[0], {
      fn: "create_appointment",
      args: {
        p_doctor_id: DOCTOR_ID,
        p_date: APPOINTMENT_DATE,
        p_start: "09:00",
        p_patient_name: "سارة محمود علي",
        p_patient_phone: "01012345678",
      },
    });

    assert.equal(booking.id, "44000000-0000-0000-0000-000000000001");
    assert.equal(booking.referenceNumber, "DR-8K29P4");
    assert.equal(booking.status, "CONFIRMED");
    assert.equal(booking.patientName, "سارة محمود علي");
    assert.equal(booking.patientPhone, "01012345678");
    assert.equal(booking.doctorId, DOCTOR_ID);
    assert.equal(booking.doctorName, "د. أحمد عبد الرحمن");
    assert.equal(booking.specialtyName, "باطنة");
    assert.equal(booking.clinicName, "عيادة النيل التخصصية");
    assert.equal(booking.clinicAddress, "شارع الجمهورية، دمنهور، البحيرة");
    assert.equal(booking.consultationFee, "250.00");
    assert.equal(booking.appointmentDate, APPOINTMENT_DATE);
    assert.equal(booking.startTime, "09:00");
    assert.equal(booking.endTime, "09:30");
    assert.equal(booking.qrCodeDataUrl.startsWith("data:image/png;base64,"), true);
  });

  it("handles array-wrapped RPC return values defensively", async () => {
    const { client } = fakeClient(baseDataset(), () => ({
      data: [appointmentRow()],
      error: null,
    }));

    const booking = await createAppointment(client, validInput, {
      generateQr: async (token) => `data:image/png;base64,qr:${token}`,
    });

    assert.equal(booking.referenceNumber, "DR-8K29P4");
    assert.equal(
      booking.qrCodeDataUrl,
      "data:image/png;base64,qr:a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718",
    );
  });

  it("rejects inactive doctor, clinic, or specialty with 404 DOCTOR_UNAVAILABLE without calling RPC", async () => {
    const scenarios = [
      { ...baseDataset(), doctors: [doctorRow(false)] },
      { ...baseDataset(), clinics: [clinicRow(false)] },
      { ...baseDataset(), specialties: [specialtyRow(false)] },
    ];

    for (const dataset of scenarios) {
      const { client, rpcCalls } = fakeClient(dataset);
      await assert.rejects(
        () => createAppointment(client, validInput),
        (err: unknown) => {
          assert.ok(err instanceof BookingServiceError);
          assert.equal(err.status, 404);
          assert.equal(err.code, "DOCTOR_UNAVAILABLE");
          assert.equal(err.message, "الدكتور ده غير متاح للحجز دلوقتي.");
          return true;
        },
      );
      assert.equal(rpcCalls.length, 0);
    }
  });

  it("maps 'Slot is not available' RPC errors to 409 SLOT_UNAVAILABLE with refreshed availability", async () => {
    const dataset = baseDataset();
    dataset.appointments.push({
      doctor_id: DOCTOR_ID,
      appointment_date: APPOINTMENT_DATE,
      start_time: "09:00:00",
      end_time: "09:30:00",
      status: "CONFIRMED",
    });

    const { client } = fakeClient(dataset, () => ({
      data: null,
      error: { code: "P0001", message: "Slot is not available" },
    }));

    await assert.rejects(
      () => createAppointment(client, validInput),
      (err: unknown) => {
        assert.ok(err instanceof BookingServiceError);
        assert.equal(err.status, 409);
        assert.equal(err.code, "SLOT_UNAVAILABLE");
        assert.equal(
          err.message,
          "المعاد ده اتحجز قبلك بشوية. اختار معاد تاني من المواعيد المتاحة.",
        );
        assert.deepEqual(err.availability, {
          date: APPOINTMENT_DATE,
          state: "AVAILABLE",
          slots: [{ start: "09:30", end: "10:00" }],
        });
        return true;
      },
    );
  });

  it("maps concurrent 23P01 overlap error to 409 SLOT_UNAVAILABLE and excludes newly booked slot", async () => {
    const { client } = fakeClient(baseDataset(), (_fn, _args, _attempt, db) => {
      db.appointments.push({
        doctor_id: DOCTOR_ID,
        appointment_date: APPOINTMENT_DATE,
        start_time: "09:00:00",
        end_time: "09:30:00",
        status: "CONFIRMED",
      });
      return {
        data: null,
        error: {
          code: "23P01",
          message:
            'conflicting key value violates exclusion constraint "appointments_no_active_overlap"',
        },
      };
    });

    await assert.rejects(
      () => createAppointment(client, validInput),
      (err: unknown) => {
        assert.ok(err instanceof BookingServiceError);
        assert.equal(err.status, 409);
        assert.equal(err.code, "SLOT_UNAVAILABLE");
        assert.deepEqual(err.availability, {
          date: APPOINTMENT_DATE,
          state: "AVAILABLE",
          slots: [{ start: "09:30", end: "10:00" }],
        });
        return true;
      },
    );
  });

  it("returns 404 DOCTOR_UNAVAILABLE when doctor becomes inactive during a slot conflict", async () => {
    const { client } = fakeClient(baseDataset(), (_fn, _args, _attempt, db) => {
      db.doctors = [doctorRow(false)];
      return {
        data: null,
        error: { code: "P0001", message: "Slot is not available" },
      };
    });

    await assert.rejects(
      () => createAppointment(client, validInput),
      (err: unknown) => {
        assert.ok(err instanceof BookingServiceError);
        assert.equal(err.status, 404);
        assert.equal(err.code, "DOCTOR_UNAVAILABLE");
        assert.equal(err.availability, undefined);
        return true;
      },
    );
  });

  it("retries once on unique reference_number collision (23505) and succeeds", async () => {
    const { client, rpcCalls } = fakeClient(baseDataset(), (_fn, _args, attempt) => {
      if (attempt === 1) {
        return {
          data: null,
          error: {
            code: "23505",
            message:
              'duplicate key value violates unique constraint "appointments_reference_number_key"',
          },
        };
      }
      return {
        data: appointmentRow({ reference_number: "DR-99AA11" }),
        error: null,
      };
    });

    const booking = await createAppointment(client, validInput, {
      generateQr: async () => "data:image/png;base64,ok",
    });

    assert.equal(rpcCalls.length, 2);
    assert.equal(booking.referenceNumber, "DR-99AA11");
  });

  it("maps remaining RPC error branches to the expected status and code", async () => {
    const { client: inactiveDoctorRpc } = fakeClient(baseDataset(), () => ({
      data: null,
      error: { message: "Doctor is not available for booking" },
    }));
    await assert.rejects(
      () => createAppointment(inactiveDoctorRpc, validInput),
      (err: unknown) =>
        err instanceof BookingServiceError &&
        err.status === 404 &&
        err.code === "DOCTOR_UNAVAILABLE",
    );

    const { client: badNameRpc } = fakeClient(baseDataset(), () => ({
      data: null,
      error: { message: "Patient name must be between 3 and 100 characters" },
    }));
    await assert.rejects(
      () => createAppointment(badNameRpc, validInput),
      (err: unknown) =>
        err instanceof BookingServiceError &&
        err.status === 400 &&
        err.code === "VALIDATION_ERROR" &&
        err.fieldErrors?.patientName === "اكتب اسمك بالكامل (3 حروف على الأقل).",
    );

    const { client: badPhoneRpc } = fakeClient(baseDataset(), () => ({
      data: null,
      error: { message: "Patient phone must be between 7 and 20 characters" },
    }));
    await assert.rejects(
      () => createAppointment(badPhoneRpc, validInput),
      (err: unknown) =>
        err instanceof BookingServiceError &&
        err.status === 400 &&
        err.code === "VALIDATION_ERROR" &&
        err.fieldErrors?.patientPhone ===
          "اكتب رقم موبايل صح (أرقام بس، من 7 لـ 20 رقم).",
    );

    const { client: emptyDataRpc } = fakeClient(baseDataset(), () => ({
      data: null,
      error: null,
    }));
    await assert.rejects(
      () => createAppointment(emptyDataRpc, validInput),
      (err: unknown) =>
        err instanceof BookingServiceError &&
        err.status === 500 &&
        err.code === "INTERNAL_ERROR",
    );
  });
});
