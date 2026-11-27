import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DELETE as deleteManualRoute } from "@/app/api/owner/doctors/[id]/manual-availability/[availabilityId]/route";
import { POST as postManualRoute } from "@/app/api/owner/doctors/[id]/manual-availability/route";
import { DELETE as deleteExceptionRoute } from "@/app/api/owner/doctors/[id]/schedule-exceptions/[exceptionId]/route";
import { POST as postExceptionRoute } from "@/app/api/owner/doctors/[id]/schedule-exceptions/route";
import {
  DELETE as deleteWeeklyRoute,
  PATCH as patchWeeklyRoute,
} from "@/app/api/owner/doctors/[id]/weekly-schedule/[scheduleId]/route";
import { POST as postWeeklyRoute } from "@/app/api/owner/doctors/[id]/weekly-schedule/route";
import { assertRole } from "@/services/auth";
import {
  createDoctorSchedulesGetHandler,
  createManualAvailabilityDeleteHandler,
  createManualAvailabilityPostHandler,
  createScheduleExceptionDeleteHandler,
  createScheduleExceptionPostHandler,
  createWeeklyScheduleDeleteHandler,
  createWeeklySchedulePatchHandler,
  createWeeklySchedulePostHandler,
} from "@/services/owner-schedules";
import type { StaffProfile } from "@/types/auth";
import type { AdminRole, Database } from "@/types/database";
import type {
  OwnerDoctorSchedules,
  OwnerErrorResponse,
  OwnerManualAvailability,
  OwnerScheduleException,
  OwnerWeeklySchedule,
} from "@/types/owner";
import { GET as getSchedulesRoute } from "./route";

const OWNER_ID = "aa000000-0000-0000-0000-000000000001";
const RECEPTIONIST_ID = "aa000000-0000-0000-0000-000000000002";
const CLINIC_ID = "11000000-0000-0000-0000-000000000001";
const SPECIALTY_ID = "22000000-0000-0000-0000-000000000001";
const DOCTOR_A_ID = "33000000-0000-0000-0000-000000000001";
const DOCTOR_B_ID = "33000000-0000-0000-0000-000000000002";
const MISSING_DOCTOR_ID = "33000000-0000-0000-0000-000000000999";

const WEEKLY_A_ID = "44000000-0000-0000-0000-000000000001";
const MANUAL_A_ID = "55000000-0000-0000-0000-000000000001";
const EXCEPTION_A_ID = "66000000-0000-0000-0000-000000000001";

const OWNER_PROFILE: StaffProfile = {
  id: OWNER_ID,
  name: "أحمد شريف",
  email: "owner@example.com",
  role: "OWNER",
  clinicId: null,
  clinicName: null,
  isActive: true,
};

const RECEPTIONIST_PROFILE: StaffProfile = {
  id: RECEPTIONIST_ID,
  name: "منى إبراهيم",
  email: "receptionist@example.com",
  role: "RECEPTIONIST",
  clinicId: CLINIC_ID,
  clinicName: "عيادة النيل التخصصية",
  isActive: true,
};

function makeRequireAdmin(session: StaffProfile | null) {
  const requestedRoles: Array<readonly AdminRole[] | undefined> = [];
  const requireAdmin = async (
    allowedRoles?: readonly AdminRole[],
  ): Promise<StaffProfile> => {
    requestedRoles.push(allowedRoles);
    return assertRole(session, allowedRoles);
  };
  return { requireAdmin, requestedRoles };
}

function createFakeAdminClient() {
  let idCounter = 200;
  const dataset: Record<string, Array<Record<string, unknown>>> = {
    clinics: [
      {
        id: CLINIC_ID,
        name: "عيادة النيل التخصصية",
        address: "شارع النيل، دمنهور",
        phone: "0453301122",
        is_active: true,
      },
    ],
    specialties: [
      {
        id: SPECIALTY_ID,
        name: "باطنة",
        description: "أمراض الباطنة",
        is_active: true,
      },
    ],
    doctors: [
      {
        id: DOCTOR_A_ID,
        clinic_id: CLINIC_ID,
        specialty_id: SPECIALTY_ID,
        full_name: "د. أحمد مصطفى",
        slot_duration_minutes: 30,
        is_active: true,
      },
      {
        id: DOCTOR_B_ID,
        clinic_id: CLINIC_ID,
        specialty_id: SPECIALTY_ID,
        full_name: "د. سارة حسن",
        slot_duration_minutes: 20,
        is_active: true,
      },
    ],
    weekly_schedules: [
      {
        id: WEEKLY_A_ID,
        doctor_id: DOCTOR_A_ID,
        day_of_week: 0,
        start_time: "09:00:00",
        end_time: "13:00:00",
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
    ],
  };

  const normalizeKey = (val: unknown) => String(val ?? "").slice(0, 5);
  const toPgTime = (val: unknown) => {
    if (typeof val !== "string") return val;
    return val.length === 5 ? `${val}:00` : val;
  };

  const client = {
    from(table: string) {
      let mode: "select" | "insert" | "update" | "delete" = "select";
      let insertPayload: Record<string, unknown> | null = null;
      let updatePayload: Record<string, unknown> | null = null;
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];

      function execute(): {
        data: Array<Record<string, unknown>> | null;
        error: { code: string; message: string } | null;
      } {
        const rows = dataset[table] ?? [];

        if (mode === "insert" && insertPayload) {
          idCounter += 1;
          const newRow: Record<string, unknown> = {
            id: `99000000-0000-0000-0000-${String(idCounter).padStart(12, "0")}`,
            created_at: "2026-11-26T12:00:00Z",
            ...insertPayload,
          };
          if (newRow.start_time) newRow.start_time = toPgTime(newRow.start_time);
          if (newRow.end_time) newRow.end_time = toPgTime(newRow.end_time);

          if (table === "weekly_schedules") {
            const dup = rows.some(
              (r) =>
                r.doctor_id === newRow.doctor_id &&
                r.day_of_week === newRow.day_of_week &&
                normalizeKey(r.start_time) === normalizeKey(newRow.start_time) &&
                normalizeKey(r.end_time) === normalizeKey(newRow.end_time),
            );
            if (dup) {
              return { data: null, error: { code: "23505", message: "dup" } };
            }
          }

          if (table === "manual_availability") {
            const dup = rows.some(
              (r) =>
                r.doctor_id === newRow.doctor_id &&
                r.availability_date === newRow.availability_date &&
                normalizeKey(r.start_time) === normalizeKey(newRow.start_time) &&
                normalizeKey(r.end_time) === normalizeKey(newRow.end_time),
            );
            if (dup) {
              return { data: null, error: { code: "23505", message: "dup" } };
            }
          }

          rows.push(newRow);
          return { data: [{ ...newRow }], error: null };
        }

        if (mode === "update" && updatePayload) {
          const matched = rows.filter((row) => filters.every((f) => f(row)));
          const updated: Array<Record<string, unknown>> = [];
          for (const target of matched) {
            const next = { ...target, ...updatePayload };
            if (next.start_time) next.start_time = toPgTime(next.start_time);
            if (next.end_time) next.end_time = toPgTime(next.end_time);
            Object.assign(target, next);
            updated.push({ ...target });
          }
          return { data: updated, error: null };
        }

        if (mode === "delete") {
          const deleted: Array<Record<string, unknown>> = [];
          const remaining: Array<Record<string, unknown>> = [];
          for (const row of rows) {
            if (filters.every((f) => f(row))) deleted.push({ ...row });
            else remaining.push(row);
          }
          dataset[table] = remaining;
          return { data: deleted, error: null };
        }

        return {
          data: rows
            .filter((row) => filters.every((f) => f(row)))
            .map((r) => ({ ...r })),
          error: null,
        };
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
        order: () => builder,
        maybeSingle: async () => {
          const res = execute();
          if (res.error) return { data: null, error: res.error };
          return { data: res.data?.[0] ?? null, error: null };
        },
        single: async () => {
          const res = execute();
          if (res.error) return { data: null, error: res.error };
          return { data: res.data?.[0] ?? null, error: null };
        },
        then: (
          resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve(execute()).then(resolve, reject),
      };

      return builder;
    },
  };

  return client as unknown as SupabaseClient<Database>;
}

describe("Owner doctor schedule API route handlers", () => {
  it("exports Next.js HTTP handlers across all 7 route files", () => {
    assert.equal(typeof getSchedulesRoute, "function");
    assert.equal(typeof postWeeklyRoute, "function");
    assert.equal(typeof patchWeeklyRoute, "function");
    assert.equal(typeof deleteWeeklyRoute, "function");
    assert.equal(typeof postManualRoute, "function");
    assert.equal(typeof deleteManualRoute, "function");
    assert.equal(typeof postExceptionRoute, "function");
    assert.equal(typeof deleteExceptionRoute, "function");
  });

  describe("RBAC and Cache-Control enforcement", () => {
    it("returns 401 UNAUTHORIZED with Cache-Control: no-store when unauthenticated", async () => {
      const { requireAdmin, requestedRoles } = makeRequireAdmin(null);
      const getHandler = createDoctorSchedulesGetHandler({ requireAdmin });
      const postWeekly = createWeeklySchedulePostHandler({ requireAdmin });
      const deleteException = createScheduleExceptionDeleteHandler({
        requireAdmin,
      });

      const res1 = await getHandler(
        new Request(`http://localhost/api/owner/doctors/${DOCTOR_A_ID}/schedules`),
        { params: Promise.resolve({ id: DOCTOR_A_ID }) },
      );
      const res2 = await postWeekly(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_A_ID}/weekly-schedule`,
          { method: "POST", body: "{}" },
        ),
        { params: Promise.resolve({ id: DOCTOR_A_ID }) },
      );
      const res3 = await deleteException(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_A_ID}/schedule-exceptions/${EXCEPTION_A_ID}`,
          { method: "DELETE" },
        ),
        {
          params: Promise.resolve({
            id: DOCTOR_A_ID,
            exceptionId: EXCEPTION_A_ID,
          }),
        },
      );

      for (const response of [res1, res2, res3]) {
        assert.equal(response.status, 401);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(
          ((await response.json()) as OwnerErrorResponse).code,
          "UNAUTHORIZED",
        );
      }
      assert.deepEqual(requestedRoles, [["OWNER"], ["OWNER"], ["OWNER"]]);
    });

    it("returns 403 FORBIDDEN for receptionist and 403 ACCOUNT_INACTIVE for inactive owner", async () => {
      const receptionist = makeRequireAdmin(RECEPTIONIST_PROFILE);
      const patchWeekly = createWeeklySchedulePatchHandler({
        requireAdmin: receptionist.requireAdmin,
      });

      const forbiddenRes = await patchWeekly(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_A_ID}/weekly-schedule/${WEEKLY_A_ID}`,
          { method: "PATCH", body: JSON.stringify({ isActive: false }) },
        ),
        {
          params: Promise.resolve({
            id: DOCTOR_A_ID,
            scheduleId: WEEKLY_A_ID,
          }),
        },
      );

      assert.equal(forbiddenRes.status, 403);
      assert.equal(forbiddenRes.headers.get("cache-control"), "no-store");
      assert.equal(
        ((await forbiddenRes.json()) as OwnerErrorResponse).code,
        "FORBIDDEN",
      );

      const inactiveOwner = makeRequireAdmin({
        ...OWNER_PROFILE,
        isActive: false,
      });
      const postManual = createManualAvailabilityPostHandler({
        requireAdmin: inactiveOwner.requireAdmin,
      });
      const inactiveRes = await postManual(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_A_ID}/manual-availability`,
          { method: "POST", body: "{}" },
        ),
        { params: Promise.resolve({ id: DOCTOR_A_ID }) },
      );

      assert.equal(inactiveRes.status, 403);
      assert.equal(inactiveRes.headers.get("cache-control"), "no-store");
      assert.equal(
        ((await inactiveRes.json()) as OwnerErrorResponse).code,
        "ACCOUNT_INACTIVE",
      );
    });
  });

  describe("Validation, CRUD, conflicts, and cross-doctor isolation", () => {
    it("validates UUIDs and JSON payloads with 400 and Cache-Control: no-store", async () => {
      const { requireAdmin } = makeRequireAdmin(OWNER_PROFILE);
      const client = createFakeAdminClient();

      const getHandler = createDoctorSchedulesGetHandler({
        requireAdmin,
        getAdminClient: () => client,
      });
      const badUuidRes = await getHandler(
        new Request("http://localhost/api/owner/doctors/not-a-uuid/schedules"),
        { params: Promise.resolve({ id: "not-a-uuid" }) },
      );
      assert.equal(badUuidRes.status, 400);
      assert.equal(badUuidRes.headers.get("cache-control"), "no-store");
      assert.equal(
        ((await badUuidRes.json()) as OwnerErrorResponse).code,
        "VALIDATION_ERROR",
      );

      const postWeekly = createWeeklySchedulePostHandler({
        requireAdmin,
        getAdminClient: () => client,
      });
      const malformedRes = await postWeekly(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_A_ID}/weekly-schedule`,
          { method: "POST", body: "{bad-json" },
        ),
        { params: Promise.resolve({ id: DOCTOR_A_ID }) },
      );
      assert.equal(malformedRes.status, 400);
      assert.equal(malformedRes.headers.get("cache-control"), "no-store");
    });

    it("handles GET /schedules, weekly POST/PATCH/DELETE, and cross-doctor 404", async () => {
      const { requireAdmin } = makeRequireAdmin(OWNER_PROFILE);
      const client = createFakeAdminClient();

      const getSchedules = createDoctorSchedulesGetHandler({
        requireAdmin,
        getAdminClient: () => client,
      });
      const postWeekly = createWeeklySchedulePostHandler({
        requireAdmin,
        getAdminClient: () => client,
      });
      const patchWeekly = createWeeklySchedulePatchHandler({
        requireAdmin,
        getAdminClient: () => client,
      });
      const deleteWeekly = createWeeklyScheduleDeleteHandler({
        requireAdmin,
        getAdminClient: () => client,
      });

      const listRes = await getSchedules(
        new Request(`http://localhost/api/owner/doctors/${DOCTOR_A_ID}/schedules`),
        { params: Promise.resolve({ id: DOCTOR_A_ID }) },
      );
      assert.equal(listRes.status, 200);
      assert.equal(listRes.headers.get("cache-control"), "no-store");
      const schedules = (await listRes.json()) as OwnerDoctorSchedules;
      assert.equal(schedules.doctor.fullName, "د. أحمد مصطفى");
      assert.equal(schedules.weeklySchedules[0].startTime, "09:00");

      const missingDocRes = await getSchedules(
        new Request(
          `http://localhost/api/owner/doctors/${MISSING_DOCTOR_ID}/schedules`,
        ),
        { params: Promise.resolve({ id: MISSING_DOCTOR_ID }) },
      );
      assert.equal(missingDocRes.status, 404);
      assert.equal(missingDocRes.headers.get("cache-control"), "no-store");

      const createRes = await postWeekly(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_A_ID}/weekly-schedule`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dayOfWeek: 3,
              startTime: "10:00",
              endTime: "14:00",
              isActive: true,
            }),
          },
        ),
        { params: Promise.resolve({ id: DOCTOR_A_ID }) },
      );
      assert.equal(createRes.status, 201);
      assert.equal(createRes.headers.get("cache-control"), "no-store");
      const createdJson = (await createRes.json()) as {
        schedule: OwnerWeeklySchedule;
      };
      assert.equal(createdJson.schedule.dayOfWeek, 3);

      const dupRes = await postWeekly(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_A_ID}/weekly-schedule`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dayOfWeek: 3,
              startTime: "10:00",
              endTime: "14:00",
              isActive: true,
            }),
          },
        ),
        { params: Promise.resolve({ id: DOCTOR_A_ID }) },
      );
      assert.equal(dupRes.status, 409);
      assert.equal(dupRes.headers.get("cache-control"), "no-store");

      // Partial patch inverting existing 09:00-13:00 time order
      const invalidPatchRes = await patchWeekly(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_A_ID}/weekly-schedule/${WEEKLY_A_ID}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startTime: "13:00" }),
          },
        ),
        {
          params: Promise.resolve({
            id: DOCTOR_A_ID,
            scheduleId: WEEKLY_A_ID,
          }),
        },
      );
      assert.equal(invalidPatchRes.status, 400);
      assert.equal(invalidPatchRes.headers.get("cache-control"), "no-store");

      // Cross-doctor patch & delete return 404
      const crossPatch = await patchWeekly(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_B_ID}/weekly-schedule/${WEEKLY_A_ID}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: false }),
          },
        ),
        {
          params: Promise.resolve({
            id: DOCTOR_B_ID,
            scheduleId: WEEKLY_A_ID,
          }),
        },
      );
      assert.equal(crossPatch.status, 404);

      const crossDelete = await deleteWeekly(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_B_ID}/weekly-schedule/${WEEKLY_A_ID}`,
          { method: "DELETE" },
        ),
        {
          params: Promise.resolve({
            id: DOCTOR_B_ID,
            scheduleId: WEEKLY_A_ID,
          }),
        },
      );
      assert.equal(crossDelete.status, 404);

      const validDelete = await deleteWeekly(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_A_ID}/weekly-schedule/${WEEKLY_A_ID}`,
          { method: "DELETE" },
        ),
        {
          params: Promise.resolve({
            id: DOCTOR_A_ID,
            scheduleId: WEEKLY_A_ID,
          }),
        },
      );
      assert.equal(validDelete.status, 200);
      assert.equal(validDelete.headers.get("cache-control"), "no-store");
      assert.deepEqual(await validDelete.json(), { ok: true });
    });

    it("handles manual availability POST/conflict/DELETE and schedule exceptions CLOSED/MODIFIED_HOURS/DELETE", async () => {
      const { requireAdmin } = makeRequireAdmin(OWNER_PROFILE);
      const client = createFakeAdminClient();

      const postManual = createManualAvailabilityPostHandler({
        requireAdmin,
        getAdminClient: () => client,
      });
      const deleteManual = createManualAvailabilityDeleteHandler({
        requireAdmin,
        getAdminClient: () => client,
      });
      const postException = createScheduleExceptionPostHandler({
        requireAdmin,
        getAdminClient: () => client,
      });
      const deleteException = createScheduleExceptionDeleteHandler({
        requireAdmin,
        getAdminClient: () => client,
      });

      const manualRes = await postManual(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_A_ID}/manual-availability`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              availabilityDate: "2026-12-22",
              startTime: "18:00",
              endTime: "20:00",
            }),
          },
        ),
        { params: Promise.resolve({ id: DOCTOR_A_ID }) },
      );
      assert.equal(manualRes.status, 201);
      assert.equal(manualRes.headers.get("cache-control"), "no-store");
      const manualJson = (await manualRes.json()) as {
        availability: OwnerManualAvailability;
      };
      assert.equal(manualJson.availability.startTime, "18:00");

      const manualDupRes = await postManual(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_A_ID}/manual-availability`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              availabilityDate: "2026-12-22",
              startTime: "18:00",
              endTime: "20:00",
            }),
          },
        ),
        { params: Promise.resolve({ id: DOCTOR_A_ID }) },
      );
      assert.equal(manualDupRes.status, 409);
      assert.equal(
        ((await manualDupRes.json()) as OwnerErrorResponse).error,
        "الميعاد الإضافي ده متسجل بالفعل في نفس اليوم والوقت.",
      );

      const crossManualDelete = await deleteManual(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_B_ID}/manual-availability/${MANUAL_A_ID}`,
          { method: "DELETE" },
        ),
        {
          params: Promise.resolve({
            id: DOCTOR_B_ID,
            availabilityId: MANUAL_A_ID,
          }),
        },
      );
      assert.equal(crossManualDelete.status, 404);

      const validManualDelete = await deleteManual(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_A_ID}/manual-availability/${MANUAL_A_ID}`,
          { method: "DELETE" },
        ),
        {
          params: Promise.resolve({
            id: DOCTOR_A_ID,
            availabilityId: MANUAL_A_ID,
          }),
        },
      );
      assert.equal(validManualDelete.status, 200);
      assert.equal(validManualDelete.headers.get("cache-control"), "no-store");

      // CLOSED with times rejected by validation
      const closedWithTimes = await postException(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_A_ID}/schedule-exceptions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              exceptionDate: "2026-12-25",
              exceptionType: "CLOSED",
              startTime: "09:00",
              endTime: "12:00",
            }),
          },
        ),
        { params: Promise.resolve({ id: DOCTOR_A_ID }) },
      );
      assert.equal(closedWithTimes.status, 400);

      // Valid CLOSED
      const closedValid = await postException(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_A_ID}/schedule-exceptions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              exceptionDate: "2026-12-25",
              exceptionType: "CLOSED",
              startTime: null,
              endTime: null,
              reason: "إجازة",
            }),
          },
        ),
        { params: Promise.resolve({ id: DOCTOR_A_ID }) },
      );
      assert.equal(closedValid.status, 201);
      assert.equal(closedValid.headers.get("cache-control"), "no-store");
      const closedJson = (await closedValid.json()) as {
        exception: OwnerScheduleException;
      };
      assert.equal(closedJson.exception.startTime, null);
      assert.equal(closedJson.exception.endTime, null);

      // Valid EXTRA_HOURS
      const extraValid = await postException(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_A_ID}/schedule-exceptions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              exceptionDate: "2026-12-26",
              exceptionType: "EXTRA_HOURS",
              startTime: "17:00",
              endTime: "20:00",
              reason: "عيادة مسائية",
            }),
          },
        ),
        { params: Promise.resolve({ id: DOCTOR_A_ID }) },
      );
      assert.equal(extraValid.status, 201);

      const crossExceptionDelete = await deleteException(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_B_ID}/schedule-exceptions/${EXCEPTION_A_ID}`,
          { method: "DELETE" },
        ),
        {
          params: Promise.resolve({
            id: DOCTOR_B_ID,
            exceptionId: EXCEPTION_A_ID,
          }),
        },
      );
      assert.equal(crossExceptionDelete.status, 404);

      const validExceptionDelete = await deleteException(
        new Request(
          `http://localhost/api/owner/doctors/${DOCTOR_A_ID}/schedule-exceptions/${EXCEPTION_A_ID}`,
          { method: "DELETE" },
        ),
        {
          params: Promise.resolve({
            id: DOCTOR_A_ID,
            exceptionId: EXCEPTION_A_ID,
          }),
        },
      );
      assert.equal(validExceptionDelete.status, 200);
      assert.equal(validExceptionDelete.headers.get("cache-control"), "no-store");
    });
  });
});
