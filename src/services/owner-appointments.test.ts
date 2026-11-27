import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import {
  getOwnerDashboardOverview,
  listOwnerAppointmentFilterOptions,
  listOwnerAppointments,
} from "./owner-appointments";
import { OwnerServiceError } from "./owner-errors";

const CLINIC_ACTIVE_ID = "11000000-0000-0000-0000-000000000001";
const CLINIC_INACTIVE_ID = "11000000-0000-0000-0000-000000000002";
const SPECIALTY_ACTIVE_ID = "22000000-0000-0000-0000-000000000001";
const SPECIALTY_INACTIVE_ID = "22000000-0000-0000-0000-000000000002";
const DOCTOR_ACTIVE_ID = "33000000-0000-0000-0000-000000000001";
const DOCTOR_INACTIVE_ID = "33000000-0000-0000-0000-000000000002";

const TODAY_NOW = { date: "2026-11-26", time: "10:00" };

type Dataset = {
  clinics: Record<string, unknown>[];
  specialties: Record<string, unknown>[];
  doctors: Record<string, unknown>[];
  admin_profiles: Record<string, unknown>[];
  appointments: Record<string, unknown>[];
};

type FakeDbOptions = {
  errors?: Partial<Record<keyof Dataset, { code?: string; message: string }>>;
};

function createFakeAdminClient(
  dataset: Dataset,
  options: FakeDbOptions = {},
): SupabaseClient<Database> {
  const client = {
    from(table: keyof Dataset) {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      let selectedCols: string | null = null;
      const orders: Array<{ col: string; ascending: boolean }> = [];

      const runQuery = () => {
        const tableError = options.errors?.[table];
        if (tableError) {
          return { data: null, error: tableError };
        }

        let rows = (dataset[table] ?? []).filter((row) =>
          filters.every((predicate) => predicate(row)),
        );

        if (orders.length > 0) {
          rows = [...rows].sort((first, second) => {
            for (const order of orders) {
              const firstVal = String(first[order.col] ?? "");
              const secondVal = String(second[order.col] ?? "");
              const cmp = firstVal.localeCompare(secondVal);
              if (cmp !== 0) {
                return order.ascending ? cmp : -cmp;
              }
            }
            return 0;
          });
        }

        if (selectedCols) {
          const cols = selectedCols
            .split(",")
            .map((col) => col.trim())
            .filter(Boolean);
          rows = rows.map((row) => {
            const projected: Record<string, unknown> = {};
            for (const col of cols) {
              projected[col] = row[col];
            }
            return projected;
          });
        }

        return { data: rows, error: null };
      };

      const builder: Record<string, unknown> = {
        select: (cols: string) => {
          selectedCols = cols;
          return builder;
        },
        eq: (col: string, value: unknown) => {
          filters.push((row) => row[col] === value);
          return builder;
        },
        in: (col: string, values: unknown[]) => {
          filters.push((row) => values.includes(row[col]));
          return builder;
        },
        gte: (col: string, value: unknown) => {
          filters.push((row) => String(row[col]) >= String(value));
          return builder;
        },
        lte: (col: string, value: unknown) => {
          filters.push((row) => String(row[col]) <= String(value));
          return builder;
        },
        order: (col: string, opts?: { ascending?: boolean }) => {
          orders.push({ col, ascending: opts?.ascending ?? true });
          return builder;
        },
        then: (
          resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve(runQuery()).then(resolve, reject),
      };

      return builder;
    },
  };

  return client as unknown as SupabaseClient<Database>;
}

function makeBaseDataset(): Dataset {
  return {
    clinics: [
      {
        id: CLINIC_ACTIVE_ID,
        name: "عيادة النيل التخصصية",
        is_active: true,
      },
      {
        id: CLINIC_INACTIVE_ID,
        name: "عيادة الرحمة المقفولة",
        is_active: false,
      },
    ],
    specialties: [
      {
        id: SPECIALTY_ACTIVE_ID,
        name: "باطنة",
        is_active: true,
      },
      {
        id: SPECIALTY_INACTIVE_ID,
        name: "عظام",
        is_active: false,
      },
    ],
    doctors: [
      {
        id: DOCTOR_ACTIVE_ID,
        clinic_id: CLINIC_ACTIVE_ID,
        specialty_id: SPECIALTY_ACTIVE_ID,
        full_name: "د. أحمد عبد الرحمن",
        is_active: true,
      },
      {
        id: DOCTOR_INACTIVE_ID,
        clinic_id: CLINIC_INACTIVE_ID,
        specialty_id: SPECIALTY_INACTIVE_ID,
        full_name: "د. سامح فؤاد",
        is_active: false,
      },
    ],
    admin_profiles: [
      {
        id: "aa000000-0000-0000-0000-000000000001",
        role: "OWNER",
        is_active: true,
      },
      {
        id: "aa000000-0000-0000-0000-000000000002",
        role: "RECEPTIONIST",
        is_active: true,
      },
      {
        id: "aa000000-0000-0000-0000-000000000003",
        role: "RECEPTIONIST",
        is_active: false,
      },
    ],
    appointments: [
      {
        id: "44000000-0000-0000-0000-000000000001",
        reference_number: "DR-PAST01",
        qr_token: "secret-qr-past",
        doctor_id: DOCTOR_INACTIVE_ID,
        clinic_id: CLINIC_INACTIVE_ID,
        patient_name: "محمود حسن",
        patient_phone: "01011112222",
        appointment_date: "2026-11-25",
        start_time: "09:00:00",
        end_time: "09:30:00",
        status: "COMPLETED",
        created_at: "2026-11-20T09:00:00Z",
      },
      {
        id: "44000000-0000-0000-0000-000000000002",
        reference_number: "DR-TDY002",
        qr_token: "secret-qr-tdy2",
        doctor_id: DOCTOR_ACTIVE_ID,
        clinic_id: CLINIC_ACTIVE_ID,
        patient_name: "سارة علي",
        patient_phone: "01022223333",
        appointment_date: "2026-11-26",
        start_time: "14:00:00",
        end_time: "14:30:00",
        status: "CONFIRMED",
        created_at: "2026-11-25T10:00:00Z",
      },
      {
        id: "44000000-0000-0000-0000-000000000003",
        reference_number: "DR-TDY001",
        qr_token: "secret-qr-tdy1",
        doctor_id: DOCTOR_INACTIVE_ID,
        clinic_id: CLINIC_INACTIVE_ID,
        patient_name: "فاطمة إبراهيم",
        patient_phone: "01033334444",
        appointment_date: "2026-11-26",
        start_time: "09:30:00",
        end_time: "10:00:00",
        status: "CHECKED_IN",
        created_at: "2026-11-25T08:00:00Z",
      },
      {
        id: "44000000-0000-0000-0000-000000000004",
        reference_number: "DR-TDYCXL",
        qr_token: "secret-qr-tdycxl",
        doctor_id: DOCTOR_ACTIVE_ID,
        clinic_id: CLINIC_ACTIVE_ID,
        patient_name: "ياسر كمال",
        patient_phone: "01044445555",
        appointment_date: "2026-11-26",
        start_time: "16:00:00",
        end_time: "16:30:00",
        status: "CANCELLED",
        created_at: "2026-11-25T11:00:00Z",
      },
      {
        id: "44000000-0000-0000-0000-000000000005",
        reference_number: "DR-UPC002",
        qr_token: "secret-qr-upc2",
        doctor_id: DOCTOR_ACTIVE_ID,
        clinic_id: CLINIC_ACTIVE_ID,
        patient_name: "نورهان طارق",
        patient_phone: "01055556666",
        appointment_date: "2026-11-28",
        start_time: "11:00:00",
        end_time: "11:30:00",
        status: "CONFIRMED",
        created_at: "2026-11-25T12:00:00Z",
      },
      {
        id: "44000000-0000-0000-0000-000000000006",
        reference_number: "DR-UPC001",
        qr_token: "secret-qr-upc1",
        doctor_id: DOCTOR_ACTIVE_ID,
        clinic_id: CLINIC_ACTIVE_ID,
        patient_name: "كريم عادل",
        patient_phone: "01066667777",
        appointment_date: "2026-11-27",
        start_time: "10:00:00",
        end_time: "10:30:00",
        status: "CHECKED_IN",
        created_at: "2026-11-25T13:00:00Z",
      },
      {
        id: "44000000-0000-0000-0000-000000000007",
        reference_number: "DR-UPCCXL",
        qr_token: "secret-qr-upccxl",
        doctor_id: DOCTOR_ACTIVE_ID,
        clinic_id: CLINIC_ACTIVE_ID,
        patient_name: "هاني نبيل",
        patient_phone: "01077778888",
        appointment_date: "2026-11-29",
        start_time: "12:00:00",
        end_time: "12:30:00",
        status: "CANCELLED",
        created_at: "2026-11-25T14:00:00Z",
      },
    ],
  };
}

describe("getOwnerDashboardOverview", () => {
  it("computes Cairo-day counts, excludes cancelled/past appointments appropriately, and hydrates inactive doctor/clinic flags", async () => {
    const client = createFakeAdminClient(makeBaseDataset());

    const overview = await getOwnerDashboardOverview(client, TODAY_NOW);

    assert.equal(overview.todayDate, "2026-11-26");
    assert.deepEqual(overview.counts, {
      clinicsTotal: 2,
      clinicsActive: 1,
      specialtiesTotal: 2,
      specialtiesActive: 1,
      doctorsTotal: 2,
      doctorsActive: 1,
      receptionistsTotal: 2,
      receptionistsActive: 1,
      todayAppointments: 2,
      upcomingAppointments: 2,
    });

    assert.deepEqual(
      overview.todayAppointments.map((item) => item.referenceNumber),
      ["DR-TDY001", "DR-TDY002"],
    );
    assert.equal(overview.todayAppointments[0].startTime, "09:30");
    assert.equal(overview.todayAppointments[0].endTime, "10:00");
    assert.equal(overview.todayAppointments[0].doctorIsActive, false);
    assert.equal(overview.todayAppointments[0].clinicIsActive, false);
    assert.equal(overview.todayAppointments[0].specialtyName, "عظام");
    assert.equal("qr_token" in overview.todayAppointments[0], false);

    assert.deepEqual(
      overview.upcomingAppointments.map((item) => item.referenceNumber),
      ["DR-UPC001", "DR-UPC002"],
    );
  });

  it("caps preview lists to 10 items while preserving full counts in overview.counts", async () => {
    const dataset = makeBaseDataset();
    dataset.appointments = [];

    for (let i = 1; i <= 12; i += 1) {
      const hour = String(8 + Math.floor((i - 1) / 2)).padStart(2, "0");
      const minute = (i - 1) % 2 === 0 ? "00" : "30";
      dataset.appointments.push({
        id: `44000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
        reference_number: `DR-T${String(i).padStart(5, "0")}`,
        doctor_id: DOCTOR_ACTIVE_ID,
        clinic_id: CLINIC_ACTIVE_ID,
        patient_name: `مريض اليوم ${i}`,
        patient_phone: `010000000${String(i).padStart(2, "0")}`,
        appointment_date: "2026-11-26",
        start_time: `${hour}:${minute}:00`,
        end_time: `${hour}:${minute === "00" ? "20" : "50"}:00`,
        status: i === 12 ? "NO_SHOW" : "CONFIRMED",
        created_at: "2026-11-25T10:00:00Z",
      });
    }

    for (let i = 1; i <= 11; i += 1) {
      dataset.appointments.push({
        id: `55000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
        reference_number: `DR-U${String(i).padStart(5, "0")}`,
        doctor_id: DOCTOR_ACTIVE_ID,
        clinic_id: CLINIC_ACTIVE_ID,
        patient_name: `مريض قادم ${i}`,
        patient_phone: `011000000${String(i).padStart(2, "0")}`,
        appointment_date: `2026-12-${String(i).padStart(2, "0")}`,
        start_time: "10:00:00",
        end_time: "10:30:00",
        status: "CONFIRMED",
        created_at: "2026-11-25T10:00:00Z",
      });
    }

    dataset.appointments.push({
      id: "66000000-0000-0000-0000-000000000001",
      reference_number: "DR-UPCOMP",
      doctor_id: DOCTOR_ACTIVE_ID,
      clinic_id: CLINIC_ACTIVE_ID,
      patient_name: "حجز منتهي",
      patient_phone: "01200000001",
      appointment_date: "2026-12-20",
      start_time: "10:00:00",
      end_time: "10:30:00",
      status: "COMPLETED",
      created_at: "2026-11-25T10:00:00Z",
    });

    const overview = await getOwnerDashboardOverview(
      createFakeAdminClient(dataset),
      TODAY_NOW,
    );

    assert.equal(overview.counts.todayAppointments, 12);
    assert.equal(overview.todayAppointments.length, 10);
    assert.equal(overview.todayAppointments[0].referenceNumber, "DR-T00001");
    assert.equal(overview.todayAppointments[9].referenceNumber, "DR-T00010");

    assert.equal(overview.counts.upcomingAppointments, 11);
    assert.equal(overview.upcomingAppointments.length, 10);
    assert.equal(overview.upcomingAppointments[0].referenceNumber, "DR-U00001");
    assert.equal(overview.upcomingAppointments[9].referenceNumber, "DR-U00010");
  });

  it("maps database failures to OwnerServiceError 500 INTERNAL_ERROR", async () => {
    const failingClient = createFakeAdminClient(makeBaseDataset(), {
      errors: { appointments: { message: "db failure" } },
    });

    await assert.rejects(
      () => getOwnerDashboardOverview(failingClient, TODAY_NOW),
      (error: unknown) =>
        error instanceof OwnerServiceError &&
        error.status === 500 &&
        error.code === "INTERNAL_ERROR",
    );
  });
});

describe("listOwnerAppointments", () => {
  it("lists platform-wide appointments including deactivated doctors and clinics in date-desc, time-asc order", async () => {
    const client = createFakeAdminClient(makeBaseDataset());

    const results = await listOwnerAppointments(client);

    assert.deepEqual(
      results.map((item) => item.referenceNumber),
      [
        "DR-UPCCXL",
        "DR-UPC002",
        "DR-UPC001",
        "DR-TDY001",
        "DR-TDY002",
        "DR-TDYCXL",
        "DR-PAST01",
      ],
    );

    const historical = results.find(
      (item) => item.referenceNumber === "DR-PAST01",
    );
    assert.ok(historical);
    assert.equal(historical.doctorIsActive, false);
    assert.equal(historical.clinicIsActive, false);
    assert.equal(historical.doctorName, "د. سامح فؤاد");
    assert.equal(historical.clinicName, "عيادة الرحمة المقفولة");
    assert.equal(historical.specialtyName, "عظام");
  });

  it("applies clinicId, doctorId, status, date, dateFrom/dateTo, and case/Arabic-digit insensitive query filters", async () => {
    const client = createFakeAdminClient(makeBaseDataset());

    const byClinic = await listOwnerAppointments(client, {
      clinicId: CLINIC_INACTIVE_ID,
    });
    assert.deepEqual(
      byClinic.map((item) => item.referenceNumber),
      ["DR-TDY001", "DR-PAST01"],
    );

    const byDoctorAndStatus = await listOwnerAppointments(client, {
      doctorId: DOCTOR_ACTIVE_ID,
      status: "CANCELLED",
    });
    assert.deepEqual(
      byDoctorAndStatus.map((item) => item.referenceNumber),
      ["DR-UPCCXL", "DR-TDYCXL"],
    );

    const byDateRange = await listOwnerAppointments(client, {
      dateFrom: "2026-11-26",
      dateTo: "2026-11-27",
    });
    assert.deepEqual(
      byDateRange.map((item) => item.referenceNumber),
      ["DR-UPC001", "DR-TDY001", "DR-TDY002", "DR-TDYCXL"],
    );

    const byDate = await listOwnerAppointments(client, { date: "2026-11-25" });
    assert.deepEqual(
      byDate.map((item) => item.referenceNumber),
      ["DR-PAST01"],
    );

    const byRefLowercase = await listOwnerAppointments(client, {
      query: "  dr-tdy002 ",
    });
    assert.deepEqual(
      byRefLowercase.map((item) => item.referenceNumber),
      ["DR-TDY002"],
    );

    const byArabicPhone = await listOwnerAppointments(client, {
      query: "٠١٠٥٥٥٥",
    });
    assert.deepEqual(
      byArabicPhone.map((item) => item.referenceNumber),
      ["DR-UPC002"],
    );

    const byDoctorName = await listOwnerAppointments(client, {
      query: "سامح فؤاد",
    });
    assert.deepEqual(
      byDoctorName.map((item) => item.referenceNumber),
      ["DR-TDY001", "DR-PAST01"],
    );

    const byClinicName = await listOwnerAppointments(client, {
      query: "الرحمة",
    });
    assert.deepEqual(
      byClinicName.map((item) => item.referenceNumber),
      ["DR-TDY001", "DR-PAST01"],
    );

    const empty = await listOwnerAppointments(client, {
      query: "غير موجود تماما",
    });
    assert.deepEqual(empty, []);
  });

  it("maps appointment or hydration query errors to OwnerServiceError 500", async () => {
    const failingAppointments = createFakeAdminClient(makeBaseDataset(), {
      errors: { appointments: { message: "boom" } },
    });
    await assert.rejects(
      () => listOwnerAppointments(failingAppointments),
      (error: unknown) =>
        error instanceof OwnerServiceError &&
        error.status === 500 &&
        error.code === "INTERNAL_ERROR",
    );

    const failingDoctors = createFakeAdminClient(makeBaseDataset(), {
      errors: { doctors: { message: "boom" } },
    });
    await assert.rejects(
      () => listOwnerAppointments(failingDoctors),
      (error: unknown) =>
        error instanceof OwnerServiceError &&
        error.status === 500 &&
        error.code === "INTERNAL_ERROR",
    );
  });
});

describe("listOwnerAppointmentFilterOptions", () => {
  it("returns all active and inactive clinics and doctors for owner filtering", async () => {
    const client = createFakeAdminClient(makeBaseDataset());

    const options = await listOwnerAppointmentFilterOptions(client);

    assert.equal(options.clinics.length, 2);
    assert.equal(
      options.clinics.some(
        (clinic) => clinic.id === CLINIC_INACTIVE_ID && !clinic.isActive,
      ),
      true,
    );

    assert.equal(options.doctors.length, 2);
    assert.equal(
      options.doctors.some(
        (doctor) =>
          doctor.id === DOCTOR_INACTIVE_ID &&
          doctor.clinicId === CLINIC_INACTIVE_ID &&
          !doctor.isActive,
      ),
      true,
    );
  });
});
