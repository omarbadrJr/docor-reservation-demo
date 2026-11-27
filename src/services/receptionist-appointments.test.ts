import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { StaffProfile } from "@/types/auth";
import type {
  Appointment,
  Clinic,
  Database,
  Doctor,
  Specialty,
} from "@/types/database";

import {
  ReceptionistServiceError,
  assertReceptionistClinic,
  checkInReceptionistAppointment,
  getReceptionistAppointmentByQrToken,
  getReceptionistAppointmentByReference,
  getReceptionistTodayDashboard,
  listReceptionistAppointments,
  listReceptionistClinicDoctors,
  updateReceptionistAppointmentStatus,
} from "./receptionist-appointments";

const CLINIC_A_ID = "11000000-0000-0000-0000-000000000001";
const CLINIC_B_ID = "11000000-0000-0000-0000-000000000002";
const SPECIALTY_ID = "22000000-0000-0000-0000-000000000001";
const DOCTOR_A_ACTIVE_ID = "33000000-0000-0000-0000-000000000001";
const DOCTOR_A_INACTIVE_ID = "33000000-0000-0000-0000-000000000002";
const DOCTOR_B_ID = "33000000-0000-0000-0000-000000000003";

const QR_A_CONFIRMED = "aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666";
const QR_B_CONFIRMED = "bbbb1111cccc2222dddd3333eeee4444ffff5555aaaa6666";

const RECEPTIONIST_A: StaffProfile = {
  id: "aa000000-0000-0000-0000-000000000002",
  name: "منى إبراهيم",
  email: "mona@example.com",
  role: "RECEPTIONIST",
  clinicId: CLINIC_A_ID,
  clinicName: "عيادة النيل التخصصية",
  isActive: true,
};

function createFakeReceptionistAdminClient(seed?: {
  appointments?: Appointment[];
  simulateConcurrentUpdateMiss?: boolean;
}) {
  const clinics: Clinic[] = [
    {
      id: CLINIC_A_ID,
      name: "عيادة النيل التخصصية",
      address: "دمنهور",
      phone: "0453311223",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: CLINIC_B_ID,
      name: "عيادة الشفاء",
      address: "كفر الدوار",
      phone: "0452211223",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];

  const specialties: Specialty[] = [
    {
      id: SPECIALTY_ID,
      name: "باطنة",
      description: null,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];

  const doctors: Doctor[] = [
    {
      id: DOCTOR_A_ACTIVE_ID,
      clinic_id: CLINIC_A_ID,
      specialty_id: SPECIALTY_ID,
      full_name: "د. أحمد مصطفى",
      photo_url: null,
      bio: null,
      qualifications: null,
      experience_years: 10,
      consultation_fee: "200.00",
      slot_duration_minutes: 30,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: DOCTOR_A_INACTIVE_ID,
      clinic_id: CLINIC_A_ID,
      specialty_id: SPECIALTY_ID,
      full_name: "د. سارة المتقاعد",
      photo_url: null,
      bio: null,
      qualifications: null,
      experience_years: 15,
      consultation_fee: "220.00",
      slot_duration_minutes: 30,
      is_active: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: DOCTOR_B_ID,
      clinic_id: CLINIC_B_ID,
      specialty_id: SPECIALTY_ID,
      full_name: "د. كريم عيادة ب",
      photo_url: null,
      bio: null,
      qualifications: null,
      experience_years: 9,
      consultation_fee: "180.00",
      slot_duration_minutes: 20,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];

  const appointments: Appointment[] = (
    seed?.appointments ?? [
      {
        id: "44000000-0000-0000-0000-000000000001",
        reference_number: "DR-8K29P4",
        qr_token: QR_A_CONFIRMED,
        doctor_id: DOCTOR_A_ACTIVE_ID,
        clinic_id: CLINIC_A_ID,
        patient_name: "سارة محمود",
        patient_phone: "01012345678",
        appointment_date: "2026-12-06",
        start_time: "09:00:00",
        end_time: "09:30:00",
        status: "CONFIRMED",
        created_at: "2026-12-01T10:00:00Z",
        updated_at: "2026-12-01T10:00:00Z",
      },
      {
        id: "44000000-0000-0000-0000-000000000002",
        reference_number: "DR-CANC01",
        qr_token: "cccc1111dddd2222eeee3333ffff4444aaaa5555bbbb6666",
        doctor_id: DOCTOR_A_INACTIVE_ID,
        clinic_id: CLINIC_A_ID,
        patient_name: "خالد حسن",
        patient_phone: "01122334455",
        appointment_date: "2026-12-06",
        start_time: "10:00:00",
        end_time: "10:30:00",
        status: "CANCELLED",
        created_at: "2026-12-01T11:00:00Z",
        updated_at: "2026-12-01T11:00:00Z",
      },
      {
        id: "44000000-0000-0000-0000-000000000003",
        reference_number: "DR-CHEK01",
        qr_token: "dddd1111eeee2222ffff3333aaaa4444bbbb5555cccc6666",
        doctor_id: DOCTOR_A_ACTIVE_ID,
        clinic_id: CLINIC_A_ID,
        patient_name: "يوسف طارق",
        patient_phone: "01234567890",
        appointment_date: "2026-12-07",
        start_time: "12:00:00",
        end_time: "12:30:00",
        status: "CHECKED_IN",
        created_at: "2026-12-01T12:00:00Z",
        updated_at: "2026-12-01T12:00:00Z",
      },
      {
        id: "44000000-0000-0000-0000-000000000004",
        reference_number: "DR-CLB001",
        qr_token: QR_B_CONFIRMED,
        doctor_id: DOCTOR_B_ID,
        clinic_id: CLINIC_B_ID,
        patient_name: "عميل عيادة ب",
        patient_phone: "01555555555",
        appointment_date: "2026-12-06",
        start_time: "09:30:00",
        end_time: "09:50:00",
        status: "CONFIRMED",
        created_at: "2026-12-01T13:00:00Z",
        updated_at: "2026-12-01T13:00:00Z",
      },
    ]
  ).map((row) => ({ ...row }));

  const tables: Record<string, Array<Record<string, unknown>>> = {
    clinics: clinics.map((row) => ({ ...row })),
    specialties: specialties.map((row) => ({ ...row })),
    doctors: doctors.map((row) => ({ ...row })),
    appointments: appointments as unknown as Array<Record<string, unknown>>,
  };

  let updateCounter = 0;

  function projectRow(
    row: Record<string, unknown>,
    selectClause: string,
  ): Record<string, unknown> {
    if (!selectClause || selectClause === "*") {
      return { ...row };
    }
    const cols = selectClause
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const out: Record<string, unknown> = {};
    for (const col of cols) {
      out[col] = row[col];
    }
    return out;
  }

  const client = {
    from(table: string) {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      let selectClause = "*";
      let pendingUpdate: Record<string, unknown> | null = null;
      const orders: Array<{ column: string; ascending: boolean }> = [];

      const execute = () => {
        const rows = tables[table] ?? [];

        if (pendingUpdate) {
          updateCounter += 1;
          if (seed?.simulateConcurrentUpdateMiss && updateCounter === 1) {
            return { data: [], error: null };
          }
          const matched = rows.filter((row) => filters.every((fn) => fn(row)));
          for (const row of matched) {
            Object.assign(row, pendingUpdate, {
              updated_at: "2026-12-06T08:00:00Z",
            });
          }
          return {
            data: matched.map((row) => projectRow(row, selectClause)),
            error: null,
          };
        }

        let matched = rows
          .filter((row) => filters.every((fn) => fn(row)))
          .map((row) => projectRow(row, selectClause));

        if (orders.length > 0) {
          matched = [...matched].sort((a, b) => {
            for (const order of orders) {
              const cmp = String(a[order.column] ?? "").localeCompare(
                String(b[order.column] ?? ""),
              );
              if (cmp !== 0) {
                return order.ascending ? cmp : -cmp;
              }
            }
            return 0;
          });
        }

        return { data: matched, error: null };
      };

      const builder: Record<string, unknown> = {
        select: (cols = "*") => {
          selectClause = cols;
          return builder;
        },
        update: (payload: Record<string, unknown>) => {
          pendingUpdate = payload;
          return builder;
        },
        eq: (column: string, value: unknown) => {
          filters.push((row) => row[column] === value);
          return builder;
        },
        in: (column: string, values: unknown[]) => {
          filters.push((row) => values.includes(row[column]));
          return builder;
        },
        order: (column: string, opts?: { ascending?: boolean }) => {
          orders.push({ column, ascending: opts?.ascending !== false });
          return builder;
        },
        maybeSingle: async () => {
          const result = execute();
          return {
            data: result.data[0] ?? null,
            error: result.error,
          };
        },
        then: (
          resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve(execute()).then(resolve, reject),
      };

      return builder;
    },
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    appointments,
  };
}

describe("receptionist-appointments service", () => {
  it("enforces receptionist role and assigned clinic via assertReceptionistClinic", () => {
    assert.equal(assertReceptionistClinic(RECEPTIONIST_A), CLINIC_A_ID);

    assert.throws(
      () =>
        assertReceptionistClinic({
          ...RECEPTIONIST_A,
          role: "OWNER",
          clinicId: null,
        }),
      (error: unknown) => (error as { status?: number }).status === 403,
    );
  });

  it("lists clinic doctors (including inactive) and appointments strictly scoped to assigned clinic", async () => {
    const { client } = createFakeReceptionistAdminClient();

    const doctors = await listReceptionistClinicDoctors(client, CLINIC_A_ID);
    assert.equal(doctors.length, 2);
    assert.ok(doctors.some((d) => d.id === DOCTOR_A_INACTIVE_ID && !d.isActive));
    assert.ok(!doctors.some((d) => d.id === DOCTOR_B_ID));

    const clinicAAppointments = await listReceptionistAppointments(
      client,
      CLINIC_A_ID,
    );
    assert.equal(clinicAAppointments.length, 3);
    assert.ok(clinicAAppointments.every((a) => a.clinicId === CLINIC_A_ID));
    assert.ok(!("qrToken" in clinicAAppointments[0]));
    assert.ok(!("qr_token" in clinicAAppointments[0]));

    const byArabicPhone = await listReceptionistAppointments(
      client,
      CLINIC_A_ID,
      { query: "٠١٠١٢٣٤٥٦٧٨" },
    );
    assert.deepEqual(
      byArabicPhone.map((a) => a.referenceNumber),
      ["DR-8K29P4"],
    );
  });

  it("loads today's Cairo-date dashboard with accurate counts and doctor list", async () => {
    const { client } = createFakeReceptionistAdminClient();

    const dashboard = await getReceptionistTodayDashboard(
      client,
      RECEPTIONIST_A,
      {
        date: "2026-12-06",
        time: "08:30",
      },
    );

    assert.equal(dashboard.clinicId, CLINIC_A_ID);
    assert.equal(dashboard.todayDate, "2026-12-06");
    assert.equal(dashboard.appointments.length, 2);
    assert.equal(dashboard.counts.total, 1);
    assert.equal(dashboard.counts.confirmed, 1);
    assert.equal(dashboard.counts.cancelled, 1);
    assert.equal(dashboard.doctors.length, 2);
  });

  it("retrieves bookings by reference or QR token and blocks cross-clinic access with 404", async () => {
    const { client } = createFakeReceptionistAdminClient();

    const foundByRef = await getReceptionistAppointmentByReference(
      client,
      CLINIC_A_ID,
      "DR-8K29P4",
    );
    assert.equal(foundByRef.patientName, "سارة محمود");
    assert.ok(!("qrToken" in foundByRef));

    const foundByQr = await getReceptionistAppointmentByQrToken(
      client,
      CLINIC_A_ID,
      QR_A_CONFIRMED,
    );
    assert.equal(foundByQr.referenceNumber, "DR-8K29P4");

    await assert.rejects(
      () => getReceptionistAppointmentByReference(client, CLINIC_A_ID, "DR-CLB001"),
      (error: unknown) =>
        error instanceof ReceptionistServiceError &&
        error.status === 404 &&
        error.code === "NOT_FOUND",
    );

    await assert.rejects(
      () => getReceptionistAppointmentByQrToken(client, CLINIC_A_ID, QR_B_CONFIRMED),
      (error: unknown) =>
        error instanceof ReceptionistServiceError &&
        error.status === 404 &&
        error.code === "NOT_FOUND",
    );
  });

  it("checks in CONFIRMED appointments and blocks CANCELLED, duplicate check-ins, and cross-clinic check-ins", async () => {
    const { client, appointments } = createFakeReceptionistAdminClient();

    const checkedIn = await checkInReceptionistAppointment(
      client,
      CLINIC_A_ID,
      "DR-8K29P4",
    );
    assert.equal(checkedIn.status, "CHECKED_IN");

    await assert.rejects(
      () => checkInReceptionistAppointment(client, CLINIC_A_ID, "DR-8K29P4"),
      (error: unknown) =>
        error instanceof ReceptionistServiceError &&
        error.status === 409 &&
        error.code === "ALREADY_CHECKED_IN",
    );

    await assert.rejects(
      () => checkInReceptionistAppointment(client, CLINIC_A_ID, "DR-CANC01"),
      (error: unknown) =>
        error instanceof ReceptionistServiceError &&
        error.status === 409 &&
        error.code === "INVALID_STATUS_TRANSITION",
    );

    await assert.rejects(
      () => checkInReceptionistAppointment(client, CLINIC_A_ID, "DR-CLB001"),
      (error: unknown) =>
        error instanceof ReceptionistServiceError &&
        error.status === 404 &&
        error.code === "NOT_FOUND",
    );
    assert.equal(appointments[3].status, "CONFIRMED");
  });

  it("handles atomic status transitions and rejects concurrent stale updates cleanly", async () => {
    const { client } = createFakeReceptionistAdminClient();

    const completed = await updateReceptionistAppointmentStatus(
      client,
      CLINIC_A_ID,
      "DR-CHEK01",
      "COMPLETED",
    );
    assert.equal(completed.status, "COMPLETED");

    await assert.rejects(
      () =>
        updateReceptionistAppointmentStatus(
          client,
          CLINIC_A_ID,
          "DR-CHEK01",
          "NO_SHOW",
        ),
      (error: unknown) =>
        error instanceof ReceptionistServiceError &&
        error.status === 409 &&
        error.code === "INVALID_STATUS_TRANSITION",
    );

    const { client: raceClient } = createFakeReceptionistAdminClient({
      simulateConcurrentUpdateMiss: true,
    });
    await assert.rejects(
      () => checkInReceptionistAppointment(raceClient, CLINIC_A_ID, "DR-8K29P4"),
      (error: unknown) =>
        error instanceof ReceptionistServiceError &&
        error.status === 409 &&
        error.code === "INVALID_STATUS_TRANSITION",
    );
  });
});
