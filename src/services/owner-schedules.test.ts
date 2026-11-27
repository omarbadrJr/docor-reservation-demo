import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { OwnerServiceError } from "./owner-errors";
import {
  createManualAvailability,
  createScheduleException,
  createWeeklySchedule,
  deleteManualAvailability,
  deleteScheduleException,
  deleteWeeklySchedule,
  getDoctorSchedules,
  updateWeeklySchedule,
} from "./owner-schedules";

const CLINIC_ID = "11000000-0000-0000-0000-000000000001";
const SPECIALTY_ID = "22000000-0000-0000-0000-000000000001";
const DOCTOR_A_ID = "33000000-0000-0000-0000-000000000001";
const DOCTOR_B_ID = "33000000-0000-0000-0000-000000000002";
const MISSING_DOCTOR_ID = "33000000-0000-0000-0000-000000000999";

const WEEKLY_A_ID = "44000000-0000-0000-0000-000000000001";
const WEEKLY_A2_ID = "44000000-0000-0000-0000-000000000002";
const WEEKLY_B_ID = "44000000-0000-0000-0000-000000000003";
const MANUAL_A_ID = "55000000-0000-0000-0000-000000000001";
const MANUAL_B_ID = "55000000-0000-0000-0000-000000000002";
const EXCEPTION_A_ID = "66000000-0000-0000-0000-000000000001";
const EXCEPTION_B_ID = "66000000-0000-0000-0000-000000000002";

type Dataset = Record<string, Array<Record<string, unknown>>>;

function toPgTime(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
}

function normalizeTimeKey(value: unknown): string {
  return String(value ?? "").slice(0, 5);
}

function createFakeScheduleAdminClient(initial?: Partial<Dataset>) {
  let idCounter = 100;
  const dataset: Dataset = {
    clinics: [
      {
        id: CLINIC_ID,
        name: "عيادة النيل التخصصية",
        address: "شارع النيل، دمنهور",
        phone: "0453301122",
        is_active: true,
        created_at: "2026-10-01T08:00:00Z",
        updated_at: "2026-10-01T08:00:00Z",
      },
    ],
    specialties: [
      {
        id: SPECIALTY_ID,
        name: "باطنة",
        description: "أمراض الباطنة",
        is_active: true,
        created_at: "2026-10-01T08:00:00Z",
        updated_at: "2026-10-01T08:00:00Z",
      },
    ],
    doctors: [
      {
        id: DOCTOR_A_ID,
        clinic_id: CLINIC_ID,
        specialty_id: SPECIALTY_ID,
        full_name: "د. أحمد مصطفى",
        photo_url: null,
        bio: null,
        qualifications: null,
        experience_years: 10,
        consultation_fee: "200.00",
        slot_duration_minutes: 30,
        is_active: true,
        created_at: "2026-10-01T08:00:00Z",
        updated_at: "2026-10-01T08:00:00Z",
      },
      {
        id: DOCTOR_B_ID,
        clinic_id: CLINIC_ID,
        specialty_id: SPECIALTY_ID,
        full_name: "د. سارة حسن",
        photo_url: null,
        bio: null,
        qualifications: null,
        experience_years: 8,
        consultation_fee: "180.00",
        slot_duration_minutes: 20,
        is_active: false,
        created_at: "2026-10-01T08:00:00Z",
        updated_at: "2026-10-01T08:00:00Z",
      },
    ],
    weekly_schedules: [
      {
        id: WEEKLY_A2_ID,
        doctor_id: DOCTOR_A_ID,
        day_of_week: 2,
        start_time: "14:00:00",
        end_time: "18:00:00",
        is_active: false,
        created_at: "2026-10-02T09:00:00Z",
      },
      {
        id: WEEKLY_A_ID,
        doctor_id: DOCTOR_A_ID,
        day_of_week: 0,
        start_time: "09:00:00",
        end_time: "13:00:00",
        is_active: true,
        created_at: "2026-10-01T09:00:00Z",
      },
      {
        id: WEEKLY_B_ID,
        doctor_id: DOCTOR_B_ID,
        day_of_week: 1,
        start_time: "10:00:00",
        end_time: "14:00:00",
        is_active: true,
        created_at: "2026-10-01T09:00:00Z",
      },
    ],
    manual_availability: [
      {
        id: MANUAL_A_ID,
        doctor_id: DOCTOR_A_ID,
        availability_date: "2026-12-05",
        start_time: "18:00:00",
        end_time: "21:00:00",
        created_at: "2026-10-01T10:00:00Z",
      },
      {
        id: MANUAL_B_ID,
        doctor_id: DOCTOR_B_ID,
        availability_date: "2026-12-06",
        start_time: "19:00:00",
        end_time: "22:00:00",
        created_at: "2026-10-01T10:00:00Z",
      },
    ],
    schedule_exceptions: [
      {
        id: EXCEPTION_A_ID,
        doctor_id: DOCTOR_A_ID,
        exception_date: "2026-12-10",
        exception_type: "MODIFIED_HOURS",
        start_time: "11:00:00",
        end_time: "15:00:00",
        reason: "تعديل مؤقت",
        created_at: "2026-10-01T11:00:00Z",
      },
      {
        id: EXCEPTION_B_ID,
        doctor_id: DOCTOR_B_ID,
        exception_date: "2026-12-11",
        exception_type: "CLOSED",
        start_time: null,
        end_time: null,
        reason: "إجازة",
        created_at: "2026-10-01T11:00:00Z",
      },
    ],
    ...initial,
  };

  function makeUuid(): string {
    idCounter += 1;
    return `99000000-0000-0000-0000-${String(idCounter).padStart(12, "0")}`;
  }

  function compareField(
    a: Record<string, unknown>,
    b: Record<string, unknown>,
    column: string,
    ascending: boolean,
  ): number {
    const valA = a[column];
    const valB = b[column];
    let diff = 0;
    if (typeof valA === "number" && typeof valB === "number") {
      diff = valA - valB;
    } else {
      diff = String(valA ?? "").localeCompare(String(valB ?? ""));
    }
    return ascending ? diff : -diff;
  }

  const client = {
    from(table: string) {
      let mode: "select" | "insert" | "update" | "delete" = "select";
      let insertPayload: Record<string, unknown> | null = null;
      let updatePayload: Record<string, unknown> | null = null;
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      const orders: Array<{ column: string; ascending: boolean }> = [];

      function execute(): {
        data: Array<Record<string, unknown>> | null;
        error: { code: string; message: string } | null;
      } {
        const rows = dataset[table] ?? [];

        if (mode === "insert" && insertPayload) {
          const newRow: Record<string, unknown> = {
            id: makeUuid(),
            created_at: `2026-11-26T12:00:${String(idCounter % 60).padStart(2, "0")}Z`,
            ...insertPayload,
          };

          if (newRow.start_time !== undefined && newRow.start_time !== null) {
            newRow.start_time = toPgTime(newRow.start_time);
          }
          if (newRow.end_time !== undefined && newRow.end_time !== null) {
            newRow.end_time = toPgTime(newRow.end_time);
          }

          if (table === "weekly_schedules") {
            const duplicate = rows.some(
              (row) =>
                row.doctor_id === newRow.doctor_id &&
                row.day_of_week === newRow.day_of_week &&
                normalizeTimeKey(row.start_time) ===
                  normalizeTimeKey(newRow.start_time) &&
                normalizeTimeKey(row.end_time) ===
                  normalizeTimeKey(newRow.end_time),
            );
            if (duplicate) {
              return {
                data: null,
                error: {
                  code: "23505",
                  message: "duplicate key value violates unique constraint",
                },
              };
            }
          }

          if (table === "manual_availability") {
            const duplicate = rows.some(
              (row) =>
                row.doctor_id === newRow.doctor_id &&
                row.availability_date === newRow.availability_date &&
                normalizeTimeKey(row.start_time) ===
                  normalizeTimeKey(newRow.start_time) &&
                normalizeTimeKey(row.end_time) ===
                  normalizeTimeKey(newRow.end_time),
            );
            if (duplicate) {
              return {
                data: null,
                error: {
                  code: "23505",
                  message: "duplicate key value violates unique constraint",
                },
              };
            }
          }

          rows.push(newRow);
          return { data: [{ ...newRow }], error: null };
        }

        if (mode === "update" && updatePayload) {
          const matched = rows.filter((row) => filters.every((f) => f(row)));
          const updatedRows: Array<Record<string, unknown>> = [];

          for (const target of matched) {
            const candidate: Record<string, unknown> = {
              ...target,
              ...updatePayload,
            };
            if (
              candidate.start_time !== undefined &&
              candidate.start_time !== null
            ) {
              candidate.start_time = toPgTime(candidate.start_time);
            }
            if (candidate.end_time !== undefined && candidate.end_time !== null) {
              candidate.end_time = toPgTime(candidate.end_time);
            }

            if (table === "weekly_schedules") {
              const duplicate = rows.some(
                (other) =>
                  other.id !== target.id &&
                  other.doctor_id === candidate.doctor_id &&
                  other.day_of_week === candidate.day_of_week &&
                  normalizeTimeKey(other.start_time) ===
                    normalizeTimeKey(candidate.start_time) &&
                  normalizeTimeKey(other.end_time) ===
                    normalizeTimeKey(candidate.end_time),
              );
              if (duplicate) {
                return {
                  data: null,
                  error: {
                    code: "23505",
                    message: "duplicate key value violates unique constraint",
                  },
                };
              }
            }

            Object.assign(target, candidate);
            updatedRows.push({ ...target });
          }

          return { data: updatedRows, error: null };
        }

        if (mode === "delete") {
          const deleted: Array<Record<string, unknown>> = [];
          const remaining: Array<Record<string, unknown>> = [];
          for (const row of rows) {
            if (filters.every((f) => f(row))) {
              deleted.push({ ...row });
            } else {
              remaining.push(row);
            }
          }
          dataset[table] = remaining;
          return { data: deleted, error: null };
        }

        const matched = rows
          .filter((row) => filters.every((f) => f(row)))
          .map((row) => ({ ...row }));

        if (orders.length > 0) {
          matched.sort((a, b) => {
            for (const order of orders) {
              const cmp = compareField(a, b, order.column, order.ascending);
              if (cmp !== 0) {
                return cmp;
              }
            }
            return 0;
          });
        }

        return { data: matched, error: null };
      }

      const builder: Record<string, unknown> = {
        select: () => builder,
        insert: (payload: Record<string, unknown>) => {
          mode = "insert";
          insertPayload = payload;
          return builder;
        },
        update: (payload: Record<string, unknown>) => {
          mode = "update";
          updatePayload = payload;
          return builder;
        },
        delete: () => {
          mode = "delete";
          return builder;
        },
        eq: (column: string, value: unknown) => {
          filters.push((row) => row[column] === value);
          return builder;
        },
        order: (column: string, options?: { ascending?: boolean }) => {
          orders.push({
            column,
            ascending: options?.ascending !== false,
          });
          return builder;
        },
        maybeSingle: async () => {
          const res = execute();
          if (res.error) {
            return { data: null, error: res.error };
          }
          return { data: res.data?.[0] ?? null, error: null };
        },
        single: async () => {
          const res = execute();
          if (res.error) {
            return { data: null, error: res.error };
          }
          const row = res.data?.[0];
          if (!row) {
            return {
              data: null,
              error: { code: "PGRST116", message: "No rows returned" },
            };
          }
          return { data: row, error: null };
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
    dataset,
  };
}

describe("owner-schedules service", () => {
  describe("getDoctorSchedules", () => {
    it("loads doctor summary and normalizes HH:MM times in sorted order", async () => {
      const { client } = createFakeScheduleAdminClient();
      const result = await getDoctorSchedules(client, DOCTOR_A_ID);

      assert.deepEqual(result.doctor, {
        id: DOCTOR_A_ID,
        fullName: "د. أحمد مصطفى",
        clinicName: "عيادة النيل التخصصية",
        specialtyName: "باطنة",
        slotDurationMinutes: 30,
        isActive: true,
      });

      assert.equal(result.weeklySchedules.length, 2);
      assert.equal(result.weeklySchedules[0].dayOfWeek, 0);
      assert.equal(result.weeklySchedules[0].startTime, "09:00");
      assert.equal(result.weeklySchedules[0].endTime, "13:00");
      assert.equal(result.weeklySchedules[1].dayOfWeek, 2);
      assert.equal(result.weeklySchedules[1].startTime, "14:00");
      assert.equal(result.weeklySchedules[1].endTime, "18:00");

      assert.equal(result.manualAvailabilities.length, 1);
      assert.equal(result.manualAvailabilities[0].startTime, "18:00");
      assert.equal(result.manualAvailabilities[0].endTime, "21:00");

      assert.equal(result.scheduleExceptions.length, 1);
      assert.equal(result.scheduleExceptions[0].startTime, "11:00");
      assert.equal(result.scheduleExceptions[0].endTime, "15:00");
    });

    it("throws 404 NOT_FOUND when doctor does not exist", async () => {
      const { client } = createFakeScheduleAdminClient();

      await assert.rejects(
        () => getDoctorSchedules(client, MISSING_DOCTOR_ID),
        (error: unknown) =>
          error instanceof OwnerServiceError &&
          error.status === 404 &&
          error.code === "NOT_FOUND",
      );
    });
  });

  describe("weekly schedule CRUD", () => {
    it("creates a weekly schedule and maps 23505 duplicates to 409 CONFLICT", async () => {
      const { client } = createFakeScheduleAdminClient();

      const created = await createWeeklySchedule(client, DOCTOR_A_ID, {
        dayOfWeek: 4,
        startTime: "10:00",
        endTime: "15:00",
        isActive: true,
      });

      assert.equal(created.doctorId, DOCTOR_A_ID);
      assert.equal(created.dayOfWeek, 4);
      assert.equal(created.startTime, "10:00");
      assert.equal(created.endTime, "15:00");
      assert.equal(created.isActive, true);

      await assert.rejects(
        () =>
          createWeeklySchedule(client, DOCTOR_A_ID, {
            dayOfWeek: 4,
            startTime: "10:00",
            endTime: "15:00",
            isActive: true,
          }),
        (error: unknown) =>
          error instanceof OwnerServiceError &&
          error.status === 409 &&
          error.code === "CONFLICT" &&
          error.message === "الفترة دي متسجلة بالفعل لنفس اليوم.",
      );
    });

    it("throws 404 when creating weekly schedule for a missing doctor", async () => {
      const { client } = createFakeScheduleAdminClient();

      await assert.rejects(
        () =>
          createWeeklySchedule(client, MISSING_DOCTOR_ID, {
            dayOfWeek: 1,
            startTime: "09:00",
            endTime: "12:00",
            isActive: true,
          }),
        (error: unknown) =>
          error instanceof OwnerServiceError && error.status === 404,
      );
    });

    it("supports partial updates and rejects partial start/end time inversion", async () => {
      const { client } = createFakeScheduleAdminClient();

      // Existing WEEKLY_A_ID is 09:00 - 13:00
      await assert.rejects(
        () =>
          updateWeeklySchedule(client, DOCTOR_A_ID, WEEKLY_A_ID, {
            startTime: "13:00",
          }),
        (error: unknown) =>
          error instanceof OwnerServiceError &&
          error.status === 400 &&
          error.code === "VALIDATION_ERROR" &&
          error.fieldErrors?.endTime === "وقت النهاية لازم يكون بعد وقت البداية.",
      );

      await assert.rejects(
        () =>
          updateWeeklySchedule(client, DOCTOR_A_ID, WEEKLY_A_ID, {
            endTime: "09:00",
          }),
        (error: unknown) =>
          error instanceof OwnerServiceError &&
          error.status === 400 &&
          error.code === "VALIDATION_ERROR" &&
          error.fieldErrors?.endTime === "وقت النهاية لازم يكون بعد وقت البداية.",
      );

      const toggled = await updateWeeklySchedule(
        client,
        DOCTOR_A_ID,
        WEEKLY_A_ID,
        {
          isActive: false,
          endTime: "14:00",
        },
      );

      assert.equal(toggled.startTime, "09:00");
      assert.equal(toggled.endTime, "14:00");
      assert.equal(toggled.isActive, false);

      await assert.rejects(
        () => updateWeeklySchedule(client, DOCTOR_A_ID, WEEKLY_A_ID, {}),
        (error: unknown) =>
          error instanceof OwnerServiceError &&
          error.status === 400 &&
          error.code === "VALIDATION_ERROR",
      );
    });

    it("enforces cross-doctor isolation on update and delete", async () => {
      const { client, dataset } = createFakeScheduleAdminClient();

      await assert.rejects(
        () =>
          updateWeeklySchedule(client, DOCTOR_B_ID, WEEKLY_A_ID, {
            isActive: false,
          }),
        (error: unknown) =>
          error instanceof OwnerServiceError &&
          error.status === 404 &&
          error.code === "NOT_FOUND",
      );

      await assert.rejects(
        () => deleteWeeklySchedule(client, DOCTOR_B_ID, WEEKLY_A_ID),
        (error: unknown) =>
          error instanceof OwnerServiceError &&
          error.status === 404 &&
          error.code === "NOT_FOUND",
      );

      const intact = dataset.weekly_schedules.find(
        (row) => row.id === WEEKLY_A_ID,
      );
      assert.ok(intact);
      assert.equal(intact.is_active, true);

      await deleteWeeklySchedule(client, DOCTOR_A_ID, WEEKLY_A_ID);
      assert.equal(
        dataset.weekly_schedules.some((row) => row.id === WEEKLY_A_ID),
        false,
      );
    });
  });

  describe("manual availability CRUD", () => {
    it("creates, detects duplicate 23505 conflicts, and deletes with isolation", async () => {
      const { client, dataset } = createFakeScheduleAdminClient();

      const created = await createManualAvailability(client, DOCTOR_A_ID, {
        availabilityDate: "2026-12-20",
        startTime: "17:00",
        endTime: "20:00",
      });

      assert.equal(created.availabilityDate, "2026-12-20");
      assert.equal(created.startTime, "17:00");
      assert.equal(created.endTime, "20:00");

      await assert.rejects(
        () =>
          createManualAvailability(client, DOCTOR_A_ID, {
            availabilityDate: "2026-12-20",
            startTime: "17:00",
            endTime: "20:00",
          }),
        (error: unknown) =>
          error instanceof OwnerServiceError &&
          error.status === 409 &&
          error.code === "CONFLICT" &&
          error.message ===
            "الميعاد الإضافي ده متسجل بالفعل في نفس اليوم والوقت.",
      );

      await assert.rejects(
        () => deleteManualAvailability(client, DOCTOR_B_ID, MANUAL_A_ID),
        (error: unknown) =>
          error instanceof OwnerServiceError && error.status === 404,
      );
      assert.equal(
        dataset.manual_availability.some((row) => row.id === MANUAL_A_ID),
        true,
      );

      await deleteManualAvailability(client, DOCTOR_A_ID, MANUAL_A_ID);
      assert.equal(
        dataset.manual_availability.some((row) => row.id === MANUAL_A_ID),
        false,
      );
    });
  });

  describe("schedule exceptions CRUD", () => {
    it("enforces null times for CLOSED and ordered times for MODIFIED_HOURS / EXTRA_HOURS", async () => {
      const { client, dataset } = createFakeScheduleAdminClient();

      const closed = await createScheduleException(client, DOCTOR_A_ID, {
        exceptionDate: "2026-12-25",
        exceptionType: "CLOSED",
        startTime: "09:00",
        endTime: "12:00",
        reason: "إجازة رسمية",
      });

      assert.equal(closed.exceptionType, "CLOSED");
      assert.equal(closed.startTime, null);
      assert.equal(closed.endTime, null);
      assert.equal(closed.reason, "إجازة رسمية");

      const extra = await createScheduleException(client, DOCTOR_A_ID, {
        exceptionDate: "2026-12-26",
        exceptionType: "EXTRA_HOURS",
        startTime: "16:00",
        endTime: "19:30",
        reason: null,
      });
      assert.equal(extra.exceptionType, "EXTRA_HOURS");
      assert.equal(extra.startTime, "16:00");
      assert.equal(extra.endTime, "19:30");

      await assert.rejects(
        () =>
          createScheduleException(client, DOCTOR_A_ID, {
            exceptionDate: "2026-12-27",
            exceptionType: "MODIFIED_HOURS",
            startTime: "14:00",
            endTime: "12:00",
            reason: null,
          }),
        (error: unknown) =>
          error instanceof OwnerServiceError &&
          error.status === 400 &&
          error.code === "VALIDATION_ERROR",
      );

      await assert.rejects(
        () => deleteScheduleException(client, DOCTOR_B_ID, EXCEPTION_A_ID),
        (error: unknown) =>
          error instanceof OwnerServiceError && error.status === 404,
      );
      assert.equal(
        dataset.schedule_exceptions.some((row) => row.id === EXCEPTION_A_ID),
        true,
      );

      await deleteScheduleException(client, DOCTOR_A_ID, EXCEPTION_A_ID);
      assert.equal(
        dataset.schedule_exceptions.some((row) => row.id === EXCEPTION_A_ID),
        false,
      );
    });
  });
});
