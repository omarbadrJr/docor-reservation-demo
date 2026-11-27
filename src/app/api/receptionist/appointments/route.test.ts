import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { GET as appointmentByReferenceGet } from "@/app/api/receptionist/appointments/[reference]/route";
import { POST as appointmentCheckInPost } from "@/app/api/receptionist/appointments/[reference]/check-in/route";
import { PATCH as appointmentStatusPatch } from "@/app/api/receptionist/appointments/[reference]/status/route";
import { GET as appointmentLookupGet } from "@/app/api/receptionist/appointments/lookup/route";
import { GET as appointmentsListGet } from "@/app/api/receptionist/appointments/route";
import { assertRole } from "@/services/auth";
import {
  createReceptionistAppointmentByReferenceGetHandler,
  createReceptionistAppointmentCheckInPostHandler,
  createReceptionistAppointmentLookupGetHandler,
  createReceptionistAppointmentsGetHandler,
  createReceptionistAppointmentStatusPatchHandler,
} from "@/services/receptionist-appointments";
import type { StaffProfile } from "@/types/auth";
import type {
  AdminRole,
  Appointment,
  Clinic,
  Database,
  Doctor,
  Specialty,
} from "@/types/database";
import type {
  ReceptionistAppointment,
  ReceptionistErrorResponse,
} from "@/types/receptionist";

const CLINIC_A_ID = "11000000-0000-0000-0000-000000000001";
const CLINIC_B_ID = "11000000-0000-0000-0000-000000000002";
const SPECIALTY_ID = "22000000-0000-0000-0000-000000000001";
const DOCTOR_A_ID = "33000000-0000-0000-0000-000000000001";
const DOCTOR_B_ID = "33000000-0000-0000-0000-000000000002";

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

const OWNER_PROFILE: StaffProfile = {
  id: "aa000000-0000-0000-0000-000000000001",
  name: "أحمد شريف",
  email: "owner@example.com",
  role: "OWNER",
  clinicId: null,
  clinicName: null,
  isActive: true,
};

function makeRequireAdmin(session: StaffProfile | null) {
  return async (allowedRoles?: readonly AdminRole[]): Promise<StaffProfile> =>
    assertRole(session, allowedRoles);
}

function makeRouteAdminClient() {
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
      id: DOCTOR_A_ID,
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

  const appointments: Appointment[] = [
    {
      id: "44000000-0000-0000-0000-000000000001",
      reference_number: "DR-8K29P4",
      qr_token: QR_A_CONFIRMED,
      doctor_id: DOCTOR_A_ID,
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
      doctor_id: DOCTOR_A_ID,
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
      created_at: "2026-12-01T12:00:00Z",
      updated_at: "2026-12-01T12:00:00Z",
    },
  ];

  const tables: Record<string, Array<Record<string, unknown>>> = {
    clinics: clinics.map((row) => ({ ...row })),
    specialties: specialties.map((row) => ({ ...row })),
    doctors: doctors.map((row) => ({ ...row })),
    appointments: appointments as unknown as Array<Record<string, unknown>>,
  };

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

  return client as unknown as SupabaseClient<Database>;
}

describe("Receptionist appointments API routes", () => {
  it("exports Next.js HTTP method handlers on all 5 receptionist appointment routes", () => {
    assert.equal(typeof appointmentsListGet, "function");
    assert.equal(typeof appointmentLookupGet, "function");
    assert.equal(typeof appointmentByReferenceGet, "function");
    assert.equal(typeof appointmentCheckInPost, "function");
    assert.equal(typeof appointmentStatusPatch, "function");
  });

  it("enforces RECEPTIONIST RBAC and Cache-Control: no-store across endpoints", async () => {
    const unauthList = createReceptionistAppointmentsGetHandler({
      requireAdmin: makeRequireAdmin(null),
    });
    const unauthRes = await unauthList(
      new Request("http://localhost/api/receptionist/appointments"),
    );
    assert.equal(unauthRes.status, 401);
    assert.equal(unauthRes.headers.get("cache-control"), "no-store");

    const ownerCheckIn = createReceptionistAppointmentCheckInPostHandler({
      requireAdmin: makeRequireAdmin(OWNER_PROFILE),
    });
    const forbiddenOwnerRes = await ownerCheckIn(
      new Request(
        "http://localhost/api/receptionist/appointments/DR-8K29P4/check-in",
        { method: "POST" },
      ),
      { params: Promise.resolve({ reference: "DR-8K29P4" }) },
    );
    assert.equal(forbiddenOwnerRes.status, 403);
    assert.equal(forbiddenOwnerRes.headers.get("cache-control"), "no-store");

    const inactiveLookup = createReceptionistAppointmentLookupGetHandler({
      requireAdmin: makeRequireAdmin({ ...RECEPTIONIST_A, isActive: false }),
    });
    const inactiveRes = await inactiveLookup(
      new Request(
        `http://localhost/api/receptionist/appointments/lookup?qrToken=${QR_A_CONFIRMED}`,
      ),
    );
    assert.equal(inactiveRes.status, 403);
    assert.equal(inactiveRes.headers.get("cache-control"), "no-store");
    assert.equal(
      ((await inactiveRes.json()) as ReceptionistErrorResponse).code,
      "ACCOUNT_INACTIVE",
    );
  });

  it("lists appointments scoped to receptionist clinic and rejects mismatched ?clinicId=", async () => {
    const client = makeRouteAdminClient();
    const handler = createReceptionistAppointmentsGetHandler({
      requireAdmin: makeRequireAdmin(RECEPTIONIST_A),
      getAdminClient: () => client,
    });

    const okRes = await handler(
      new Request("http://localhost/api/receptionist/appointments"),
    );
    assert.equal(okRes.status, 200);
    assert.equal(okRes.headers.get("cache-control"), "no-store");
    const okBody = (await okRes.json()) as {
      appointments: ReceptionistAppointment[];
    };
    assert.equal(okBody.appointments.length, 2);
    assert.ok(okBody.appointments.every((a) => a.clinicId === CLINIC_A_ID));

    const crossClinicRes = await handler(
      new Request(
        `http://localhost/api/receptionist/appointments?clinicId=${CLINIC_B_ID}`,
      ),
    );
    assert.equal(crossClinicRes.status, 403);
    assert.equal(crossClinicRes.headers.get("cache-control"), "no-store");
  });

  it("supports lookup by reference or QR token and blocks cross-clinic access", async () => {
    const client = makeRouteAdminClient();
    const lookupHandler = createReceptionistAppointmentLookupGetHandler({
      requireAdmin: makeRequireAdmin(RECEPTIONIST_A),
      getAdminClient: () => client,
    });
    const byRefHandler = createReceptionistAppointmentByReferenceGetHandler({
      requireAdmin: makeRequireAdmin(RECEPTIONIST_A),
      getAdminClient: () => client,
    });

    const qrRes = await lookupHandler(
      new Request(
        `http://localhost/api/receptionist/appointments/lookup?qrToken=${QR_A_CONFIRMED}`,
      ),
    );
    assert.equal(qrRes.status, 200);
    assert.equal(qrRes.headers.get("cache-control"), "no-store");
    const qrBody = (await qrRes.json()) as {
      appointment: ReceptionistAppointment;
    };
    assert.equal(qrBody.appointment.referenceNumber, "DR-8K29P4");
    assert.ok(!("qrToken" in qrBody.appointment));
    assert.ok(!("qr_token" in qrBody.appointment));

    const crossQrRes = await lookupHandler(
      new Request(
        `http://localhost/api/receptionist/appointments/lookup?qrToken=${QR_B_CONFIRMED}`,
      ),
    );
    assert.equal(crossQrRes.status, 404);
    assert.equal(crossQrRes.headers.get("cache-control"), "no-store");

    const refRes = await byRefHandler(
      new Request("http://localhost/api/receptionist/appointments/dr-8k29p4"),
      { params: Promise.resolve({ reference: "dr-8k29p4" }) },
    );
    assert.equal(refRes.status, 200);
    assert.equal(refRes.headers.get("cache-control"), "no-store");
  });

  it("handles check-in and status transitions while rejecting CANCELLED and cross-clinic mutations", async () => {
    const client = makeRouteAdminClient();
    const checkInHandler = createReceptionistAppointmentCheckInPostHandler({
      requireAdmin: makeRequireAdmin(RECEPTIONIST_A),
      getAdminClient: () => client,
    });
    const statusHandler = createReceptionistAppointmentStatusPatchHandler({
      requireAdmin: makeRequireAdmin(RECEPTIONIST_A),
      getAdminClient: () => client,
    });

    const checkInRes = await checkInHandler(
      new Request(
        "http://localhost/api/receptionist/appointments/dr-8k29p4/check-in",
        { method: "POST" },
      ),
      { params: Promise.resolve({ reference: "dr-8k29p4" }) },
    );
    assert.equal(checkInRes.status, 200);
    assert.equal(checkInRes.headers.get("cache-control"), "no-store");
    const checkInBody = (await checkInRes.json()) as {
      appointment: ReceptionistAppointment;
    };
    assert.equal(checkInBody.appointment.status, "CHECKED_IN");

    const cancelledCheckIn = await checkInHandler(
      new Request(
        "http://localhost/api/receptionist/appointments/DR-CANC01/check-in",
        { method: "POST" },
      ),
      { params: Promise.resolve({ reference: "DR-CANC01" }) },
    );
    assert.equal(cancelledCheckIn.status, 409);
    assert.equal(cancelledCheckIn.headers.get("cache-control"), "no-store");

    const completeRes = await statusHandler(
      new Request(
        "http://localhost/api/receptionist/appointments/DR-8K29P4/status",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "COMPLETED" }),
        },
      ),
      { params: Promise.resolve({ reference: "DR-8K29P4" }) },
    );
    assert.equal(completeRes.status, 200);
    assert.equal(completeRes.headers.get("cache-control"), "no-store");
    const completeBody = (await completeRes.json()) as {
      appointment: ReceptionistAppointment;
    };
    assert.equal(completeBody.appointment.status, "COMPLETED");

    const crossClinicCheckIn = await checkInHandler(
      new Request(
        "http://localhost/api/receptionist/appointments/DR-CLB001/check-in",
        { method: "POST" },
      ),
      { params: Promise.resolve({ reference: "DR-CLB001" }) },
    );
    assert.equal(crossClinicCheckIn.status, 404);
    assert.equal(crossClinicCheckIn.headers.get("cache-control"), "no-store");
  });
});
