import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { GET as overviewGet } from "@/app/api/owner/overview/route";
import { assertRole } from "@/services/auth";
import {
  createOwnerAppointmentsGetHandler,
  createOwnerOverviewGetHandler,
} from "@/services/owner-appointments";
import type { StaffProfile } from "@/types/auth";
import type { AdminRole, Database } from "@/types/database";
import type {
  OwnerAppointment,
  OwnerDashboardOverview,
  OwnerErrorResponse,
} from "@/types/owner";

import { GET as appointmentsGet } from "./route";

const OWNER_ID = "aa000000-0000-0000-0000-000000000001";
const RECEPTIONIST_ID = "aa000000-0000-0000-0000-000000000002";
const CLINIC_1 = "11000000-0000-0000-0000-000000000001";
const CLINIC_2 = "11000000-0000-0000-0000-000000000002";
const SPECIALTY_1 = "22000000-0000-0000-0000-000000000001";
const DOCTOR_1 = "33000000-0000-0000-0000-000000000001";
const DOCTOR_2 = "33000000-0000-0000-0000-000000000002";

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
  clinicId: CLINIC_1,
  clinicName: "عيادة النيل",
  isActive: true,
};

function makeRequireAdminSpy(session: StaffProfile | null) {
  const requestedRoles: Array<readonly AdminRole[] | undefined> = [];

  const requireAdmin = async (
    allowedRoles?: readonly AdminRole[],
  ): Promise<StaffProfile> => {
    requestedRoles.push(allowedRoles);
    return assertRole(session, allowedRoles);
  };

  return { requireAdmin, requestedRoles };
}

function createFakeAdminClient(options?: { failTable?: string }) {
  const dataset: Record<string, Record<string, unknown>[]> = {
    clinics: [
      { id: CLINIC_1, name: "عيادة النيل", is_active: true },
      { id: CLINIC_2, name: "عيادة الأمل", is_active: false },
    ],
    specialties: [{ id: SPECIALTY_1, name: "باطنة", is_active: true }],
    doctors: [
      {
        id: DOCTOR_1,
        clinic_id: CLINIC_1,
        specialty_id: SPECIALTY_1,
        full_name: "د. أحمد مصطفى",
        is_active: true,
      },
      {
        id: DOCTOR_2,
        clinic_id: CLINIC_2,
        specialty_id: SPECIALTY_1,
        full_name: "د. سامي عادل",
        is_active: false,
      },
    ],
    admin_profiles: [
      { id: RECEPTIONIST_ID, role: "RECEPTIONIST", is_active: true },
    ],
    appointments: [
      {
        id: "44000000-0000-0000-0000-000000000001",
        reference_number: "DR-8K29P4",
        qr_token: "qr-secret-1",
        doctor_id: DOCTOR_1,
        clinic_id: CLINIC_1,
        patient_name: "سارة محمود",
        patient_phone: "01012345678",
        appointment_date: "2026-11-26",
        start_time: "11:00:00",
        end_time: "11:30:00",
        status: "CONFIRMED",
        created_at: "2026-11-25T10:00:00Z",
      },
      {
        id: "44000000-0000-0000-0000-000000000002",
        reference_number: "DR-OLD111",
        qr_token: "qr-secret-2",
        doctor_id: DOCTOR_2,
        clinic_id: CLINIC_2,
        patient_name: "حسام حسن",
        patient_phone: "01099887766",
        appointment_date: "2026-11-20",
        start_time: "09:00:00",
        end_time: "09:30:00",
        status: "COMPLETED",
        created_at: "2026-11-18T10:00:00Z",
      },
    ],
  };

  const client = {
    from(table: string) {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      let selectedCols: string | null = null;
      const orders: Array<{ col: string; ascending: boolean }> = [];

      const runQuery = () => {
        if (options?.failTable === table) {
          return { data: null, error: { message: "boom" } };
        }

        let rows = (dataset[table] ?? []).filter((row) =>
          filters.every((predicate) => predicate(row)),
        );

        if (orders.length > 0) {
          rows = [...rows].sort((first, second) => {
            for (const order of orders) {
              const cmp = String(first[order.col] ?? "").localeCompare(
                String(second[order.col] ?? ""),
              );
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
            const out: Record<string, unknown> = {};
            for (const col of cols) {
              out[col] = row[col];
            }
            return out;
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

describe("Owner overview and appointments route handlers", () => {
  it("exports Next.js GET handlers on both routes", () => {
    assert.equal(typeof overviewGet, "function");
    assert.equal(typeof appointmentsGet, "function");
  });

  describe("GET /api/owner/overview", () => {
    it("enforces OWNER RBAC and Cache-Control: no-store", async () => {
      const unauth = makeRequireAdminSpy(null);
      const unauthRes = await createOwnerOverviewGetHandler({
        requireAdmin: unauth.requireAdmin,
      })();
      assert.equal(unauthRes.status, 401);
      assert.equal(unauthRes.headers.get("cache-control"), "no-store");
      assert.deepEqual(unauth.requestedRoles, [["OWNER"]]);

      const forbidden = makeRequireAdminSpy(RECEPTIONIST_PROFILE);
      const forbiddenRes = await createOwnerOverviewGetHandler({
        requireAdmin: forbidden.requireAdmin,
      })();
      assert.equal(forbiddenRes.status, 403);
      assert.equal(forbiddenRes.headers.get("cache-control"), "no-store");
      assert.equal(
        ((await forbiddenRes.json()) as OwnerErrorResponse).code,
        "FORBIDDEN",
      );

      const inactive = makeRequireAdminSpy({
        ...OWNER_PROFILE,
        isActive: false,
      });
      const inactiveRes = await createOwnerOverviewGetHandler({
        requireAdmin: inactive.requireAdmin,
      })();
      assert.equal(inactiveRes.status, 403);
      assert.equal(inactiveRes.headers.get("cache-control"), "no-store");
      assert.equal(
        ((await inactiveRes.json()) as OwnerErrorResponse).code,
        "ACCOUNT_INACTIVE",
      );
    });

    it("returns 200 overview payload and maps DB failure to 500 with no-store", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const okRes = await createOwnerOverviewGetHandler({
        requireAdmin,
        getAdminClient: () => createFakeAdminClient(),
        getNow: () => ({ date: "2026-11-26", time: "10:00" }),
      })();

      assert.equal(okRes.status, 200);
      assert.equal(okRes.headers.get("cache-control"), "no-store");
      const okJson = (await okRes.json()) as {
        overview: OwnerDashboardOverview;
      };
      assert.equal(okJson.overview.todayDate, "2026-11-26");
      assert.equal(okJson.overview.counts.clinicsTotal, 2);
      assert.equal(okJson.overview.counts.todayAppointments, 1);
      assert.equal(
        okJson.overview.todayAppointments[0].referenceNumber,
        "DR-8K29P4",
      );

      const errRes = await createOwnerOverviewGetHandler({
        requireAdmin,
        getAdminClient: () =>
          createFakeAdminClient({ failTable: "appointments" }),
        getNow: () => ({ date: "2026-11-26", time: "10:00" }),
      })();
      assert.equal(errRes.status, 500);
      assert.equal(errRes.headers.get("cache-control"), "no-store");
      assert.equal(
        ((await errRes.json()) as OwnerErrorResponse).code,
        "INTERNAL_ERROR",
      );
    });
  });

  describe("GET /api/owner/appointments", () => {
    it("enforces OWNER RBAC and Cache-Control: no-store", async () => {
      const unauth = makeRequireAdminSpy(null);
      const unauthRes = await createOwnerAppointmentsGetHandler({
        requireAdmin: unauth.requireAdmin,
      })(new Request("http://localhost/api/owner/appointments"));
      assert.equal(unauthRes.status, 401);
      assert.equal(unauthRes.headers.get("cache-control"), "no-store");
      assert.deepEqual(unauth.requestedRoles, [["OWNER"]]);

      const forbidden = makeRequireAdminSpy(RECEPTIONIST_PROFILE);
      const forbiddenRes = await createOwnerAppointmentsGetHandler({
        requireAdmin: forbidden.requireAdmin,
      })(new Request("http://localhost/api/owner/appointments"));
      assert.equal(forbiddenRes.status, 403);
      assert.equal(forbiddenRes.headers.get("cache-control"), "no-store");

      const inactive = makeRequireAdminSpy({
        ...OWNER_PROFILE,
        isActive: false,
      });
      const inactiveRes = await createOwnerAppointmentsGetHandler({
        requireAdmin: inactive.requireAdmin,
      })(new Request("http://localhost/api/owner/appointments"));
      assert.equal(inactiveRes.status, 403);
      assert.equal(inactiveRes.headers.get("cache-control"), "no-store");
      assert.equal(
        ((await inactiveRes.json()) as OwnerErrorResponse).code,
        "ACCOUNT_INACTIVE",
      );
    });

    it("returns 400 VALIDATION_ERROR for invalid filter query parameters", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createOwnerAppointmentsGetHandler({
        requireAdmin,
        getAdminClient: () => createFakeAdminClient(),
      });

      const badClinicRes = await handler(
        new Request("http://localhost/api/owner/appointments?clinicId=bad-uuid"),
      );
      assert.equal(badClinicRes.status, 400);
      assert.equal(badClinicRes.headers.get("cache-control"), "no-store");
      const badClinicJson = (await badClinicRes.json()) as OwnerErrorResponse;
      assert.equal(badClinicJson.code, "VALIDATION_ERROR");
      assert.ok(badClinicJson.fieldErrors?.clinicId);

      const badRangeRes = await handler(
        new Request(
          "http://localhost/api/owner/appointments?status=PENDING&date=2026-02-30&dateFrom=2026-11-28&dateTo=2026-11-20",
        ),
      );
      assert.equal(badRangeRes.status, 400);
      assert.equal(badRangeRes.headers.get("cache-control"), "no-store");
      const badRangeJson = (await badRangeRes.json()) as OwnerErrorResponse;
      assert.equal(badRangeJson.code, "VALIDATION_ERROR");
      assert.ok(badRangeJson.fieldErrors?.status);
      assert.ok(badRangeJson.fieldErrors?.date);
      assert.ok(badRangeJson.fieldErrors?.dateTo);

      const duplicateParamRes = await handler(
        new Request(
          `http://localhost/api/owner/appointments?clinicId=${CLINIC_1}&clinicId=${CLINIC_2}`,
        ),
      );
      assert.equal(duplicateParamRes.status, 400);
      assert.equal(duplicateParamRes.headers.get("cache-control"), "no-store");
      const duplicateJson =
        (await duplicateParamRes.json()) as OwnerErrorResponse;
      assert.equal(duplicateJson.code, "VALIDATION_ERROR");
      assert.ok(duplicateJson.fieldErrors?.clinicId);
    });

    it("returns 200 appointments across all clinics (including inactive records, without qr_token) and supports filters", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createOwnerAppointmentsGetHandler({
        requireAdmin,
        getAdminClient: () => createFakeAdminClient(),
      });

      const allRes = await handler(
        new Request("http://localhost/api/owner/appointments"),
      );
      assert.equal(allRes.status, 200);
      assert.equal(allRes.headers.get("cache-control"), "no-store");
      const allJson = (await allRes.json()) as {
        appointments: Array<OwnerAppointment & { qr_token?: string }>;
      };
      assert.deepEqual(
        allJson.appointments.map((item) => item.referenceNumber),
        ["DR-8K29P4", "DR-OLD111"],
      );
      assert.equal(allJson.appointments[0].qr_token, undefined);
      assert.equal(allJson.appointments[1].doctorIsActive, false);
      assert.equal(allJson.appointments[1].clinicIsActive, false);

      const filteredRes = await handler(
        new Request(
          `http://localhost/api/owner/appointments?clinicId=${CLINIC_2}&doctorId=${DOCTOR_2}&status=COMPLETED&date=2026-11-20&query=DR-OLD111`,
        ),
      );
      assert.equal(filteredRes.status, 200);
      assert.equal(filteredRes.headers.get("cache-control"), "no-store");
      const filteredJson = (await filteredRes.json()) as {
        appointments: OwnerAppointment[];
      };
      assert.deepEqual(
        filteredJson.appointments.map((item) => item.referenceNumber),
        ["DR-OLD111"],
      );
    });

    it("returns 500 INTERNAL_ERROR when database query fails", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createOwnerAppointmentsGetHandler({
        requireAdmin,
        getAdminClient: () =>
          createFakeAdminClient({ failTable: "appointments" }),
      });

      const response = await handler(
        new Request("http://localhost/api/owner/appointments"),
      );
      assert.equal(response.status, 500);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(
        ((await response.json()) as OwnerErrorResponse).code,
        "INTERNAL_ERROR",
      );
    });
  });
});
