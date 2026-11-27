import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CairoNow } from "@/lib/cairo-time";
import { getDoctorAvailability, listDoctorAvailableDates } from "@/services/availability";
import { getPublicDoctorById, listDoctorsBySpecialty } from "@/services/doctors";
import { listOwnerAppointments } from "@/services/owner-appointments";
import { updateOwnerClinic } from "@/services/owner-clinics";
import { updateOwnerDoctor } from "@/services/owner-doctors";
import {
  createManualAvailability,
  createScheduleException,
  createWeeklySchedule,
  deleteScheduleException,
} from "@/services/owner-schedules";
import type {
  Appointment,
  Clinic,
  Database,
  Doctor,
  ManualAvailability,
  ScheduleException,
  Specialty,
  WeeklySchedule,
} from "@/types/database";

const CLINIC_ID = "11000000-0000-0000-0000-000000000001";
const SPECIALTY_ID = "22000000-0000-0000-0000-000000000001";
const DOCTOR_ID = "33000000-0000-0000-0000-000000000001";
const WEEKLY_ID = "55000000-0000-0000-0000-000000000001";
const APPOINTMENT_ID = "44000000-0000-0000-0000-000000000001";

const NOW: CairoNow = { date: "2026-12-01", time: "08:00" };
const TARGET_SUNDAY = "2026-12-06";
const NEXT_SUNDAY = "2026-12-13";

type StoreTables = {
  clinics: Clinic[];
  specialties: Specialty[];
  doctors: Doctor[];
  weekly_schedules: WeeklySchedule[];
  manual_availability: ManualAvailability[];
  schedule_exceptions: ScheduleException[];
  appointments: Appointment[];
};

type TableName = keyof StoreTables;
type AnyRow = Record<string, unknown>;

type QueryResult<T = unknown> = {
  data: T;
  count?: number | null;
  error: null | { code?: string; message: string; details?: string };
};

const TABLES_WITH_UPDATED_AT = new Set<TableName>([
  "clinics",
  "specialties",
  "doctors",
  "appointments",
]);

function projectRow(row: AnyRow, selectColumns: string | null): AnyRow {
  if (!selectColumns || selectColumns.trim() === "*") {
    return { ...row };
  }

  const cols = selectColumns
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const projected: AnyRow = {};
  for (const col of cols) {
    projected[col] = row[col];
  }
  return projected;
}

function createInMemorySupabaseClient(
  initial: Partial<StoreTables> = {},
): SupabaseClient<Database> {
  const store: StoreTables = {
    clinics: (initial.clinics ?? []).map((row) => ({ ...row })),
    specialties: (initial.specialties ?? []).map((row) => ({ ...row })),
    doctors: (initial.doctors ?? []).map((row) => ({ ...row })),
    weekly_schedules: (initial.weekly_schedules ?? []).map((row) => ({ ...row })),
    manual_availability: (initial.manual_availability ?? []).map((row) => ({
      ...row,
    })),
    schedule_exceptions: (initial.schedule_exceptions ?? []).map((row) => ({
      ...row,
    })),
    appointments: (initial.appointments ?? []).map((row) => ({ ...row })),
  };

  const client = {
    from(table: TableName) {
      let operation: "select" | "insert" | "update" | "delete" = "select";
      let selectedColumns: string | null = null;
      let countExact = false;
      let headOnly = false;
      let insertPayloads: AnyRow[] = [];
      let updatePayload: AnyRow = {};
      const filters: Array<(row: AnyRow) => boolean> = [];
      const orders: Array<{ column: string; ascending: boolean }> = [];

      const applyFiltersAndOrders = (rows: AnyRow[]): AnyRow[] => {
        let matched = rows.filter((row) =>
          filters.every((predicate) => predicate(row)),
        );

        if (orders.length > 0) {
          matched = [...matched].sort((first, second) => {
            for (const order of orders) {
              const firstVal = first[order.column];
              const secondVal = second[order.column];
              const cmp =
                typeof firstVal === "number" && typeof secondVal === "number"
                  ? firstVal - secondVal
                  : String(firstVal ?? "").localeCompare(
                      String(secondVal ?? ""),
                    );
              if (cmp !== 0) {
                return order.ascending ? cmp : -cmp;
              }
            }
            return 0;
          });
        }

        return matched;
      };

      const execute = (): QueryResult => {
        const tableRows = store[table] as unknown as AnyRow[];
        const nowIso = new Date().toISOString();

        if (operation === "insert") {
          const inserted: AnyRow[] = [];
          for (const raw of insertPayloads) {
            const row: AnyRow = {
              id:
                typeof raw.id === "string" && raw.id.length > 0
                  ? raw.id
                  : crypto.randomUUID(),
              ...raw,
              created_at:
                typeof raw.created_at === "string" ? raw.created_at : nowIso,
            };

            if (TABLES_WITH_UPDATED_AT.has(table) && row.updated_at === undefined) {
              row.updated_at = nowIso;
            }
            if (
              (table === "clinics" ||
                table === "specialties" ||
                table === "doctors" ||
                table === "weekly_schedules") &&
              row.is_active === undefined
            ) {
              row.is_active = true;
            }

            tableRows.push(row);
            inserted.push(projectRow(row, selectedColumns));
          }

          return { data: inserted, error: null };
        }

        if (operation === "update") {
          const matched = applyFiltersAndOrders(tableRows);
          const updated: AnyRow[] = [];
          for (const row of matched) {
            Object.assign(row, updatePayload);
            if (TABLES_WITH_UPDATED_AT.has(table)) {
              row.updated_at = nowIso;
            }
            updated.push(projectRow(row, selectedColumns));
          }
          return { data: updated, error: null };
        }

        if (operation === "delete") {
          const matchedSet = new Set(applyFiltersAndOrders(tableRows));
          const deleted: AnyRow[] = [];
          for (let index = tableRows.length - 1; index >= 0; index -= 1) {
            const row = tableRows[index];
            if (matchedSet.has(row)) {
              deleted.unshift(projectRow(row, selectedColumns));
              tableRows.splice(index, 1);
            }
          }
          return { data: deleted, error: null };
        }

        const matched = applyFiltersAndOrders(tableRows);
        const count = countExact ? matched.length : undefined;

        if (headOnly) {
          return {
            data: null,
            ...(count !== undefined ? { count } : {}),
            error: null,
          };
        }

        return {
          data: matched.map((row) => projectRow(row, selectedColumns)),
          ...(count !== undefined ? { count } : {}),
          error: null,
        };
      };

      const builder: Record<string, unknown> = {
        select(
          columns?: string,
          options?: { count?: "exact"; head?: boolean },
        ) {
          selectedColumns = columns ?? "*";
          if (options?.count === "exact") {
            countExact = true;
          }
          if (options?.head) {
            headOnly = true;
          }
          return builder;
        },
        insert(payload: AnyRow | AnyRow[]) {
          operation = "insert";
          insertPayloads = Array.isArray(payload) ? payload : [payload];
          return builder;
        },
        update(payload: AnyRow) {
          operation = "update";
          updatePayload = payload;
          return builder;
        },
        delete() {
          operation = "delete";
          return builder;
        },
        eq(column: string, value: unknown) {
          filters.push((row) => row[column] === value);
          return builder;
        },
        in(column: string, values: unknown[]) {
          filters.push((row) => values.includes(row[column]));
          return builder;
        },
        gte(column: string, value: unknown) {
          filters.push((row) => String(row[column]) >= String(value));
          return builder;
        },
        lte(column: string, value: unknown) {
          filters.push((row) => String(row[column]) <= String(value));
          return builder;
        },
        order(column: string, options?: { ascending?: boolean }) {
          orders.push({ column, ascending: options?.ascending ?? true });
          return builder;
        },
        async single(): Promise<QueryResult> {
          const result = execute();
          if (result.error) {
            return result;
          }
          const rows = Array.isArray(result.data) ? result.data : [];
          if (rows.length !== 1) {
            return {
              data: null,
              error: {
                code: "PGRST116",
                message: "Expected a single row",
              },
            };
          }
          return { data: rows[0], error: null };
        },
        async maybeSingle(): Promise<QueryResult> {
          const result = execute();
          if (result.error) {
            return result;
          }
          const rows = Array.isArray(result.data) ? result.data : [];
          if (rows.length > 1) {
            return {
              data: null,
              error: {
                code: "PGRST116",
                message: "Multiple rows returned",
              },
            };
          }
          return { data: rows[0] ?? null, error: null };
        },
        then(
          onFulfilled: (value: QueryResult) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          return Promise.resolve(execute()).then(onFulfilled, onRejected);
        },
      };

      return builder;
    },
  };

  return client as unknown as SupabaseClient<Database>;
}

function makeClinic(overrides: Partial<Clinic> = {}): Clinic {
  return {
    id: CLINIC_ID,
    name: "عيادة النيل التخصصية",
    address: "شارع الجمهورية، دمنهور، البحيرة",
    phone: "0453311223",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeSpecialty(overrides: Partial<Specialty> = {}): Specialty {
  return {
    id: SPECIALTY_ID,
    name: "باطنة",
    description: "أمراض الباطنة والسكر",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeDoctor(overrides: Partial<Doctor> = {}): Doctor {
  return {
    id: DOCTOR_ID,
    clinic_id: CLINIC_ID,
    specialty_id: SPECIALTY_ID,
    full_name: "د. أحمد مصطفى",
    photo_url: "/doctors/demo-portrait.svg",
    bio: "استشاري باطنة",
    qualifications: "دكتوراه أمراض الباطنة",
    experience_years: 10,
    consultation_fee: "200.00",
    slot_duration_minutes: 30,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeWeeklySchedule(
  overrides: Partial<WeeklySchedule> = {},
): WeeklySchedule {
  return {
    id: WEEKLY_ID,
    doctor_id: DOCTOR_ID,
    day_of_week: 0,
    start_time: "09:00",
    end_time: "11:00",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: APPOINTMENT_ID,
    reference_number: "DR-8K29P4",
    qr_token: "secret-qr-token-1",
    doctor_id: DOCTOR_ID,
    clinic_id: CLINIC_ID,
    patient_name: "سارة محمود",
    patient_phone: "01012345678",
    appointment_date: "2026-11-15",
    start_time: "09:00:00",
    end_time: "09:30:00",
    status: "COMPLETED",
    created_at: "2026-11-10T10:00:00Z",
    updated_at: "2026-11-15T09:30:00Z",
    ...overrides,
  };
}

describe("Owner & public service integration", () => {
  it("hides a deactivated doctor from public discovery and availability while preserving historical owner appointments (SRS §10 Scenario 10)", async () => {
    const db = createInMemorySupabaseClient({
      clinics: [makeClinic()],
      specialties: [makeSpecialty()],
      doctors: [makeDoctor()],
      weekly_schedules: [makeWeeklySchedule()],
      appointments: [makeAppointment()],
    });

    const profileBefore = await getPublicDoctorById(db, DOCTOR_ID);
    assert.ok(profileBefore);
    assert.equal(profileBefore.id, DOCTOR_ID);

    const listBefore = await listDoctorsBySpecialty(db, {
      id: SPECIALTY_ID,
      name: "باطنة",
      description: null,
    });
    assert.equal(listBefore.length, 1);

    const availabilityBefore = await getDoctorAvailability(
      db,
      DOCTOR_ID,
      TARGET_SUNDAY,
      NOW,
    );
    assert.deepEqual(availabilityBefore, {
      date: TARGET_SUNDAY,
      state: "AVAILABLE",
      slots: [
        { start: "09:00", end: "09:30" },
        { start: "09:30", end: "10:00" },
        { start: "10:00", end: "10:30" },
        { start: "10:30", end: "11:00" },
      ],
    });

    const updatedDoctor = await updateOwnerDoctor(db, DOCTOR_ID, {
      isActive: false,
    });
    assert.equal(updatedDoctor.isActive, false);

    assert.equal(await getPublicDoctorById(db, DOCTOR_ID), null);
    assert.equal(
      await getDoctorAvailability(db, DOCTOR_ID, TARGET_SUNDAY, NOW),
      null,
    );
    assert.equal(
      await listDoctorAvailableDates(db, DOCTOR_ID, "2026-12", NOW),
      null,
    );
    assert.deepEqual(
      await listDoctorsBySpecialty(db, {
        id: SPECIALTY_ID,
        name: "باطنة",
        description: null,
      }),
      [],
    );

    const ownerAppointments = await listOwnerAppointments(db);
    assert.equal(ownerAppointments.length, 1);
    assert.equal(ownerAppointments[0].id, APPOINTMENT_ID);
    assert.equal(ownerAppointments[0].referenceNumber, "DR-8K29P4");
    assert.equal(ownerAppointments[0].doctorIsActive, false);
    assert.equal(ownerAppointments[0].clinicIsActive, true);
  });

  it("blocks public profile and availability when the clinic is deactivated while preserving historical owner appointments", async () => {
    const db = createInMemorySupabaseClient({
      clinics: [makeClinic()],
      specialties: [makeSpecialty()],
      doctors: [makeDoctor()],
      weekly_schedules: [makeWeeklySchedule()],
      appointments: [makeAppointment()],
    });

    assert.ok(await getPublicDoctorById(db, DOCTOR_ID));
    const availabilityBefore = await getDoctorAvailability(
      db,
      DOCTOR_ID,
      TARGET_SUNDAY,
      NOW,
    );
    assert.equal(availabilityBefore?.state, "AVAILABLE");
    assert.equal(availabilityBefore?.slots.length, 4);

    const updatedClinic = await updateOwnerClinic(db, CLINIC_ID, {
      isActive: false,
    });
    assert.equal(updatedClinic.isActive, false);
    assert.equal(updatedClinic.doctorCount, 1);

    assert.equal(await getPublicDoctorById(db, DOCTOR_ID), null);
    assert.equal(
      await getDoctorAvailability(db, DOCTOR_ID, TARGET_SUNDAY, NOW),
      null,
    );
    assert.equal(
      await listDoctorAvailableDates(db, DOCTOR_ID, "2026-12", NOW),
      null,
    );
    assert.deepEqual(
      await listDoctorsBySpecialty(db, {
        id: SPECIALTY_ID,
        name: "باطنة",
        description: null,
      }),
      [],
    );

    const ownerAppointments = await listOwnerAppointments(db);
    assert.equal(ownerAppointments.length, 1);
    assert.equal(ownerAppointments[0].id, APPOINTMENT_ID);
    assert.equal(ownerAppointments[0].clinicIsActive, false);
    assert.equal(ownerAppointments[0].doctorIsActive, true);
  });

  it("applies schedule precedence across weekly schedules, CLOSED/MODIFIED_HOURS exceptions, and manual availability (SRS §10 Scenario 9)", async () => {
    const db = createInMemorySupabaseClient({
      clinics: [makeClinic()],
      specialties: [makeSpecialty()],
      doctors: [makeDoctor()],
    });

    await createWeeklySchedule(db, DOCTOR_ID, {
      dayOfWeek: 0,
      startTime: "09:00",
      endTime: "11:00",
      isActive: true,
    });

    const initialAvailability = await getDoctorAvailability(
      db,
      DOCTOR_ID,
      TARGET_SUNDAY,
      NOW,
    );
    assert.deepEqual(initialAvailability, {
      date: TARGET_SUNDAY,
      state: "AVAILABLE",
      slots: [
        { start: "09:00", end: "09:30" },
        { start: "09:30", end: "10:00" },
        { start: "10:00", end: "10:30" },
        { start: "10:30", end: "11:00" },
      ],
    });

    const closedException = await createScheduleException(db, DOCTOR_ID, {
      exceptionDate: TARGET_SUNDAY,
      exceptionType: "CLOSED",
      startTime: null,
      endTime: null,
      reason: "إجازة",
    });

    assert.deepEqual(
      await getDoctorAvailability(db, DOCTOR_ID, TARGET_SUNDAY, NOW),
      {
        date: TARGET_SUNDAY,
        state: "OFF",
        slots: [],
      },
    );

    const unaffectedSunday = await getDoctorAvailability(
      db,
      DOCTOR_ID,
      NEXT_SUNDAY,
      NOW,
    );
    assert.equal(unaffectedSunday?.state, "AVAILABLE");
    assert.equal(unaffectedSunday?.slots.length, 4);

    await deleteScheduleException(db, DOCTOR_ID, closedException.id);

    const modifiedException = await createScheduleException(db, DOCTOR_ID, {
      exceptionDate: TARGET_SUNDAY,
      exceptionType: "MODIFIED_HOURS",
      startTime: "13:00",
      endTime: "14:00",
      reason: "تغيير ساعات العمل",
    });

    assert.deepEqual(
      await getDoctorAvailability(db, DOCTOR_ID, TARGET_SUNDAY, NOW),
      {
        date: TARGET_SUNDAY,
        state: "AVAILABLE",
        slots: [
          { start: "13:00", end: "13:30" },
          { start: "13:30", end: "14:00" },
        ],
      },
    );

    await createManualAvailability(db, DOCTOR_ID, {
      availabilityDate: TARGET_SUNDAY,
      startTime: "18:00",
      endTime: "19:00",
    });

    assert.deepEqual(
      await getDoctorAvailability(db, DOCTOR_ID, TARGET_SUNDAY, NOW),
      {
        date: TARGET_SUNDAY,
        state: "AVAILABLE",
        slots: [
          { start: "13:00", end: "13:30" },
          { start: "13:30", end: "14:00" },
          { start: "18:00", end: "18:30" },
          { start: "18:30", end: "19:00" },
        ],
      },
    );

    await deleteScheduleException(db, DOCTOR_ID, modifiedException.id);

    assert.deepEqual(
      await getDoctorAvailability(db, DOCTOR_ID, TARGET_SUNDAY, NOW),
      {
        date: TARGET_SUNDAY,
        state: "AVAILABLE",
        slots: [
          { start: "09:00", end: "09:30" },
          { start: "09:30", end: "10:00" },
          { start: "10:00", end: "10:30" },
          { start: "10:30", end: "11:00" },
          { start: "18:00", end: "18:30" },
          { start: "18:30", end: "19:00" },
        ],
      },
    );
  });
});
