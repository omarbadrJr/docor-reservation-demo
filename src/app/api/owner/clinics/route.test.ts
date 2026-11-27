import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { PATCH as clinicPatch } from "@/app/api/owner/clinics/[id]/route";
import {
  GET as clinicsGet,
  POST as clinicsPost,
} from "@/app/api/owner/clinics/route";
import { assertRole } from "@/services/auth";
import {
  createOwnerClinicPatchHandler,
  createOwnerClinicsGetHandler,
  createOwnerClinicsPostHandler,
} from "@/services/owner-clinics";
import type { StaffProfile } from "@/types/auth";
import type { AdminRole, Clinic, Database } from "@/types/database";
import type { OwnerClinic, OwnerErrorResponse } from "@/types/owner";

const OWNER_ID = "aa000000-0000-0000-0000-000000000001";
const RECEPTIONIST_ID = "aa000000-0000-0000-0000-000000000002";
const CLINIC_ID = "11000000-0000-0000-0000-000000000001";
const MISSING_CLINIC_ID = "11000000-0000-0000-0000-000000000099";

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

function makeFakeAdminClient(options?: {
  clinics?: Clinic[];
  doctors?: Array<{ id: string; clinic_id: string }>;
  insertError?: { code?: string; message: string } | null;
  updateError?: { code?: string; message: string } | null;
}) {
  const clinics = [...(options?.clinics ?? [])];
  const doctors = [...(options?.doctors ?? [])];

  const client = {
    from(table: "clinics" | "doctors") {
      if (table === "doctors") {
        let filteredClinicId: string | null = null;
        const builder = {
          select: () => builder,
          eq: (_column: string, value: string) => {
            filteredClinicId = value;
            const count = doctors.filter(
              (doc) => doc.clinic_id === filteredClinicId,
            ).length;
            return Promise.resolve({ data: null, count, error: null });
          },
          then(
            onFulfilled: (value: {
              data: Array<{ clinic_id: string }>;
              error: null;
            }) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) {
            return Promise.resolve({
              data: doctors.map((doc) => ({ clinic_id: doc.clinic_id })),
              error: null,
            }).then(onFulfilled, onRejected);
          },
        };
        return builder;
      }

      return {
        select: () => ({
          order: async () => ({ data: clinics, error: null }),
        }),
        insert: (payload: {
          name: string;
          address: string;
          phone: string;
          is_active: boolean;
        }) => ({
          select: () => ({
            single: async () => {
              if (options?.insertError) {
                return { data: null, error: options.insertError };
              }
              const row: Clinic = {
                id: "11000000-0000-0000-0000-000000000010",
                name: payload.name,
                address: payload.address,
                phone: payload.phone,
                is_active: payload.is_active,
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
              };
              clinics.push(row);
              return { data: row, error: null };
            },
          }),
        }),
        update: (updates: Partial<Clinic>) => ({
          eq: (_column: string, id: string) => ({
            select: () => ({
              maybeSingle: async () => {
                if (options?.updateError) {
                  return { data: null, error: options.updateError };
                }
                const index = clinics.findIndex((c) => c.id === id);
                if (index === -1) {
                  return { data: null, error: null };
                }
                const updated: Clinic = {
                  ...clinics[index],
                  ...updates,
                  updated_at: "2026-02-01T00:00:00Z",
                };
                clinics[index] = updated;
                return { data: updated, error: null };
              },
            }),
          }),
        }),
      };
    },
  };

  return client as unknown as SupabaseClient<Database>;
}

function makeClinicRow(overrides: Partial<Clinic> = {}): Clinic {
  return {
    id: CLINIC_ID,
    name: "عيادة النيل التخصصية",
    address: "شارع الجمهورية، دمنهور",
    phone: "0453311223",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("Owner clinics API route handlers", () => {
  it("exports Next.js GET, POST, and PATCH handlers", () => {
    assert.equal(typeof clinicsGet, "function");
    assert.equal(typeof clinicsPost, "function");
    assert.equal(typeof clinicPatch, "function");
  });

  describe("RBAC enforcement", () => {
    it("returns 401 UNAUTHORIZED with Cache-Control: no-store when unauthenticated", async () => {
      const { requireAdmin, requestedRoles } = makeRequireAdminSpy(null);
      const getHandler = createOwnerClinicsGetHandler({ requireAdmin });
      const postHandler = createOwnerClinicsPostHandler({ requireAdmin });
      const patchHandler = createOwnerClinicPatchHandler({ requireAdmin });

      const getRes = await getHandler();
      const postRes = await postHandler(
        new Request("http://localhost/api/owner/clinics", {
          method: "POST",
          body: "{bad-json",
        }),
      );
      const patchRes = await patchHandler(
        new Request(`http://localhost/api/owner/clinics/${CLINIC_ID}`, {
          method: "PATCH",
          body: "{}",
        }),
        { params: Promise.resolve({ id: "not-a-uuid" }) },
      );

      for (const res of [getRes, postRes, patchRes]) {
        assert.equal(res.status, 401);
        assert.equal(res.headers.get("cache-control"), "no-store");
        assert.equal(((await res.json()) as OwnerErrorResponse).code, "UNAUTHORIZED");
      }

      assert.deepEqual(requestedRoles, [["OWNER"], ["OWNER"], ["OWNER"]]);
    });

    it("returns 403 FORBIDDEN for receptionist and 403 ACCOUNT_INACTIVE for inactive owner", async () => {
      const { requireAdmin: recAuth } = makeRequireAdminSpy(RECEPTIONIST_PROFILE);
      const getHandler = createOwnerClinicsGetHandler({ requireAdmin: recAuth });
      const recRes = await getHandler();
      assert.equal(recRes.status, 403);
      assert.equal(recRes.headers.get("cache-control"), "no-store");
      assert.equal(((await recRes.json()) as OwnerErrorResponse).code, "FORBIDDEN");

      const { requireAdmin: inactiveOwnerAuth } = makeRequireAdminSpy({
        ...OWNER_PROFILE,
        isActive: false,
      });
      const postHandler = createOwnerClinicsPostHandler({
        requireAdmin: inactiveOwnerAuth,
      });
      const inactiveRes = await postHandler(
        new Request("http://localhost/api/owner/clinics", {
          method: "POST",
          body: JSON.stringify({}),
        }),
      );
      assert.equal(inactiveRes.status, 403);
      assert.equal(inactiveRes.headers.get("cache-control"), "no-store");
      assert.equal(
        ((await inactiveRes.json()) as OwnerErrorResponse).code,
        "ACCOUNT_INACTIVE",
      );
    });
  });

  describe("GET /api/owner/clinics", () => {
    it("returns 200 with clinics list and Cache-Control: no-store", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createOwnerClinicsGetHandler({
        requireAdmin,
        getAdminClient: () =>
          makeFakeAdminClient({
            clinics: [makeClinicRow()],
            doctors: [{ id: "d1", clinic_id: CLINIC_ID }],
          }),
      });

      const response = await handler();

      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = (await response.json()) as { clinics: OwnerClinic[] };
      assert.equal(body.clinics.length, 1);
      assert.equal(body.clinics[0].doctorCount, 1);
    });
  });

  describe("POST /api/owner/clinics", () => {
    it("returns 400 VALIDATION_ERROR on invalid JSON or missing/invalid fields", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createOwnerClinicsPostHandler({
        requireAdmin,
        getAdminClient: () => makeFakeAdminClient(),
      });

      const badJsonRes = await handler(
        new Request("http://localhost/api/owner/clinics", {
          method: "POST",
          body: "not-json",
        }),
      );
      assert.equal(badJsonRes.status, 400);
      assert.equal(badJsonRes.headers.get("cache-control"), "no-store");
      assert.equal(
        ((await badJsonRes.json()) as OwnerErrorResponse).code,
        "VALIDATION_ERROR",
      );

      const invalidFieldsRes = await handler(
        new Request("http://localhost/api/owner/clinics", {
          method: "POST",
          body: JSON.stringify({
            name: "",
            address: "",
            phone: "12",
          }),
        }),
      );
      assert.equal(invalidFieldsRes.status, 400);
      assert.equal(invalidFieldsRes.headers.get("cache-control"), "no-store");
      const invalidBody = (await invalidFieldsRes.json()) as OwnerErrorResponse;
      assert.equal(invalidBody.code, "VALIDATION_ERROR");
      assert.ok(invalidBody.fieldErrors?.name);
      assert.ok(invalidBody.fieldErrors?.address);
      assert.ok(invalidBody.fieldErrors?.phone);
    });

    it("returns 409 CONFLICT on duplicate constraint", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createOwnerClinicsPostHandler({
        requireAdmin,
        getAdminClient: () =>
          makeFakeAdminClient({
            insertError: { code: "23505", message: "duplicate" },
          }),
      });

      const response = await handler(
        new Request("http://localhost/api/owner/clinics", {
          method: "POST",
          body: JSON.stringify({
            name: "عيادة النيل التخصصية",
            address: "شارع الجمهورية",
            phone: "0453311223",
          }),
        }),
      );

      assert.equal(response.status, 409);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = (await response.json()) as OwnerErrorResponse;
      assert.equal(body.code, "CONFLICT");
      assert.equal(body.error, "العيادة دي موجودة بالفعل.");
    });

    it("returns 201 with created clinic and Cache-Control: no-store", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createOwnerClinicsPostHandler({
        requireAdmin,
        getAdminClient: () => makeFakeAdminClient(),
      });

      const response = await handler(
        new Request("http://localhost/api/owner/clinics", {
          method: "POST",
          body: JSON.stringify({
            name: "  عيادة الرحمة  ",
            address: "  دمنهور - شارع السلام  ",
            phone: "٠٤٥٣٣٢٢١١٠",
            isActive: true,
          }),
        }),
      );

      assert.equal(response.status, 201);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = (await response.json()) as { clinic: OwnerClinic };
      assert.equal(body.clinic.name, "عيادة الرحمة");
      assert.equal(body.clinic.phone, "0453322110");
      assert.equal(body.clinic.doctorCount, 0);
    });
  });

  describe("PATCH /api/owner/clinics/[id]", () => {
    it("returns 400 on invalid UUID param or empty/invalid body", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createOwnerClinicPatchHandler({
        requireAdmin,
        getAdminClient: () => makeFakeAdminClient({ clinics: [makeClinicRow()] }),
      });

      const badIdRes = await handler(
        new Request("http://localhost/api/owner/clinics/bad-id", {
          method: "PATCH",
          body: JSON.stringify({ isActive: false }),
        }),
        { params: Promise.resolve({ id: "bad-id" }) },
      );
      assert.equal(badIdRes.status, 400);
      assert.equal(badIdRes.headers.get("cache-control"), "no-store");

      const emptyBodyRes = await handler(
        new Request(`http://localhost/api/owner/clinics/${CLINIC_ID}`, {
          method: "PATCH",
          body: JSON.stringify({}),
        }),
        { params: Promise.resolve({ id: CLINIC_ID }) },
      );
      assert.equal(emptyBodyRes.status, 400);
      assert.equal(emptyBodyRes.headers.get("cache-control"), "no-store");
    });

    it("returns 404 NOT_FOUND when clinic is missing", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createOwnerClinicPatchHandler({
        requireAdmin,
        getAdminClient: () => makeFakeAdminClient({ clinics: [] }),
      });

      const response = await handler(
        new Request(`http://localhost/api/owner/clinics/${MISSING_CLINIC_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: false }),
        }),
        { params: Promise.resolve({ id: MISSING_CLINIC_ID }) },
      );

      assert.equal(response.status, 404);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual((await response.json()) as OwnerErrorResponse, {
        error: "العيادة دي مش موجودة.",
        code: "NOT_FOUND",
      });
    });

    it("returns 200 with updated clinic and Cache-Control: no-store", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createOwnerClinicPatchHandler({
        requireAdmin,
        getAdminClient: () =>
          makeFakeAdminClient({
            clinics: [makeClinicRow()],
            doctors: [
              { id: "d1", clinic_id: CLINIC_ID },
              { id: "d2", clinic_id: CLINIC_ID },
            ],
          }),
      });

      const response = await handler(
        new Request(`http://localhost/api/owner/clinics/${CLINIC_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: false }),
        }),
        { params: Promise.resolve({ id: CLINIC_ID }) },
      );

      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = (await response.json()) as { clinic: OwnerClinic };
      assert.equal(body.clinic.isActive, false);
      assert.equal(body.clinic.doctorCount, 2);
    });
  });
});
