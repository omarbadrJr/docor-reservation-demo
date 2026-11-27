import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { PATCH as specialtyPatch } from "@/app/api/owner/specialties/[id]/route";
import {
  GET as specialtiesGet,
  POST as specialtiesPost,
} from "@/app/api/owner/specialties/route";
import { assertRole } from "@/services/auth";
import {
  createOwnerSpecialtiesGetHandler,
  createOwnerSpecialtiesPostHandler,
  createOwnerSpecialtyPatchHandler,
} from "@/services/owner-specialties";
import type { StaffProfile } from "@/types/auth";
import type { AdminRole, Database, Specialty } from "@/types/database";
import type { OwnerErrorResponse, OwnerSpecialty } from "@/types/owner";

const OWNER_ID = "aa000000-0000-0000-0000-000000000001";
const RECEPTIONIST_ID = "aa000000-0000-0000-0000-000000000002";
const CLINIC_ID = "11000000-0000-0000-0000-000000000001";
const SPECIALTY_ID = "22000000-0000-0000-0000-000000000001";
const MISSING_SPECIALTY_ID = "22000000-0000-0000-0000-000000000099";

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
  specialties?: Specialty[];
  doctors?: Array<{ id: string; specialty_id: string }>;
  insertError?: { code?: string; message: string } | null;
  updateError?: { code?: string; message: string } | null;
}) {
  const specialties = [...(options?.specialties ?? [])];
  const doctors = [...(options?.doctors ?? [])];

  const client = {
    from(table: "specialties" | "doctors") {
      if (table === "doctors") {
        let filteredSpecialtyId: string | null = null;
        const builder = {
          select: () => builder,
          eq: (_column: string, value: string) => {
            filteredSpecialtyId = value;
            const count = doctors.filter(
              (doc) => doc.specialty_id === filteredSpecialtyId,
            ).length;
            return Promise.resolve({ data: null, count, error: null });
          },
          then(
            onFulfilled: (value: {
              data: Array<{ specialty_id: string }>;
              error: null;
            }) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) {
            return Promise.resolve({
              data: doctors.map((doc) => ({ specialty_id: doc.specialty_id })),
              error: null,
            }).then(onFulfilled, onRejected);
          },
        };
        return builder;
      }

      return {
        select: () => ({
          order: async () => ({ data: specialties, error: null }),
        }),
        insert: (payload: {
          name: string;
          description: string | null;
          is_active: boolean;
        }) => ({
          select: () => ({
            single: async () => {
              if (options?.insertError) {
                return { data: null, error: options.insertError };
              }
              const row: Specialty = {
                id: "22000000-0000-0000-0000-000000000010",
                name: payload.name,
                description: payload.description,
                is_active: payload.is_active,
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
              };
              specialties.push(row);
              return { data: row, error: null };
            },
          }),
        }),
        update: (updates: Partial<Specialty>) => ({
          eq: (_column: string, id: string) => ({
            select: () => ({
              maybeSingle: async () => {
                if (options?.updateError) {
                  return { data: null, error: options.updateError };
                }
                const index = specialties.findIndex((s) => s.id === id);
                if (index === -1) {
                  return { data: null, error: null };
                }
                const updated: Specialty = {
                  ...specialties[index],
                  ...updates,
                  updated_at: "2026-02-01T00:00:00Z",
                };
                specialties[index] = updated;
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

function makeSpecialtyRow(overrides: Partial<Specialty> = {}): Specialty {
  return {
    id: SPECIALTY_ID,
    name: "باطنة",
    description: "متابعة الأمراض المزمنة",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("Owner specialties API route handlers", () => {
  it("exports Next.js GET, POST, and PATCH handlers", () => {
    assert.equal(typeof specialtiesGet, "function");
    assert.equal(typeof specialtiesPost, "function");
    assert.equal(typeof specialtyPatch, "function");
  });

  describe("RBAC enforcement", () => {
    it("returns 401 UNAUTHORIZED with Cache-Control: no-store when unauthenticated", async () => {
      const { requireAdmin, requestedRoles } = makeRequireAdminSpy(null);
      const getHandler = createOwnerSpecialtiesGetHandler({ requireAdmin });
      const postHandler = createOwnerSpecialtiesPostHandler({ requireAdmin });
      const patchHandler = createOwnerSpecialtyPatchHandler({ requireAdmin });

      const getRes = await getHandler();
      const postRes = await postHandler(
        new Request("http://localhost/api/owner/specialties", {
          method: "POST",
          body: "{bad-json",
        }),
      );
      const patchRes = await patchHandler(
        new Request(`http://localhost/api/owner/specialties/${SPECIALTY_ID}`, {
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

    it("returns 403 FORBIDDEN when called by a receptionist", async () => {
      const { requireAdmin } = makeRequireAdminSpy(RECEPTIONIST_PROFILE);
      const handler = createOwnerSpecialtiesPostHandler({ requireAdmin });

      const response = await handler(
        new Request("http://localhost/api/owner/specialties", {
          method: "POST",
          body: JSON.stringify({ name: "باطنة" }),
        }),
      );

      assert.equal(response.status, 403);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(((await response.json()) as OwnerErrorResponse).code, "FORBIDDEN");
    });
  });

  describe("GET /api/owner/specialties", () => {
    it("returns 200 with specialties list and Cache-Control: no-store", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createOwnerSpecialtiesGetHandler({
        requireAdmin,
        getAdminClient: () =>
          makeFakeAdminClient({
            specialties: [makeSpecialtyRow()],
            doctors: [
              { id: "d1", specialty_id: SPECIALTY_ID },
              { id: "d2", specialty_id: SPECIALTY_ID },
            ],
          }),
      });

      const response = await handler();

      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = (await response.json()) as {
        specialties: OwnerSpecialty[];
      };
      assert.equal(body.specialties.length, 1);
      assert.equal(body.specialties[0].doctorCount, 2);
    });
  });

  describe("POST /api/owner/specialties", () => {
    it("returns 400 VALIDATION_ERROR on invalid JSON or invalid fields", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createOwnerSpecialtiesPostHandler({
        requireAdmin,
        getAdminClient: () => makeFakeAdminClient(),
      });

      const badJsonRes = await handler(
        new Request("http://localhost/api/owner/specialties", {
          method: "POST",
          body: "{",
        }),
      );
      assert.equal(badJsonRes.status, 400);
      assert.equal(badJsonRes.headers.get("cache-control"), "no-store");

      const missingNameRes = await handler(
        new Request("http://localhost/api/owner/specialties", {
          method: "POST",
          body: JSON.stringify({ name: "   " }),
        }),
      );
      assert.equal(missingNameRes.status, 400);
      assert.equal(missingNameRes.headers.get("cache-control"), "no-store");
      const errBody = (await missingNameRes.json()) as OwnerErrorResponse;
      assert.equal(errBody.code, "VALIDATION_ERROR");
      assert.ok(errBody.fieldErrors?.name);
    });

    it("returns 409 CONFLICT when specialty name already exists", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createOwnerSpecialtiesPostHandler({
        requireAdmin,
        getAdminClient: () =>
          makeFakeAdminClient({
            insertError: { code: "23505", message: "duplicate key" },
          }),
      });

      const response = await handler(
        new Request("http://localhost/api/owner/specialties", {
          method: "POST",
          body: JSON.stringify({ name: "باطنة" }),
        }),
      );

      assert.equal(response.status, 409);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual((await response.json()) as OwnerErrorResponse, {
        error: "التخصص ده موجود بالفعل.",
        code: "CONFLICT",
      });
    });

    it("returns 201 with created specialty and Cache-Control: no-store", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createOwnerSpecialtiesPostHandler({
        requireAdmin,
        getAdminClient: () => makeFakeAdminClient(),
      });

      const response = await handler(
        new Request("http://localhost/api/owner/specialties", {
          method: "POST",
          body: JSON.stringify({
            name: "  رمد  ",
            description: "  فحص النظر  ",
          }),
        }),
      );

      assert.equal(response.status, 201);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = (await response.json()) as { specialty: OwnerSpecialty };
      assert.equal(body.specialty.name, "رمد");
      assert.equal(body.specialty.description, "فحص النظر");
      assert.equal(body.specialty.isActive, true);
      assert.equal(body.specialty.doctorCount, 0);
    });
  });

  describe("PATCH /api/owner/specialties/[id]", () => {
    it("returns 400 on invalid UUID param or empty body", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createOwnerSpecialtyPatchHandler({
        requireAdmin,
        getAdminClient: () =>
          makeFakeAdminClient({ specialties: [makeSpecialtyRow()] }),
      });

      const badIdRes = await handler(
        new Request("http://localhost/api/owner/specialties/invalid", {
          method: "PATCH",
          body: JSON.stringify({ isActive: false }),
        }),
        { params: Promise.resolve({ id: "invalid" }) },
      );
      assert.equal(badIdRes.status, 400);
      assert.equal(badIdRes.headers.get("cache-control"), "no-store");

      const emptyRes = await handler(
        new Request(`http://localhost/api/owner/specialties/${SPECIALTY_ID}`, {
          method: "PATCH",
          body: JSON.stringify({}),
        }),
        { params: Promise.resolve({ id: SPECIALTY_ID }) },
      );
      assert.equal(emptyRes.status, 400);
      assert.equal(emptyRes.headers.get("cache-control"), "no-store");
    });

    it("returns 404 NOT_FOUND when specialty is missing", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createOwnerSpecialtyPatchHandler({
        requireAdmin,
        getAdminClient: () => makeFakeAdminClient({ specialties: [] }),
      });

      const response = await handler(
        new Request(
          `http://localhost/api/owner/specialties/${MISSING_SPECIALTY_ID}`,
          {
            method: "PATCH",
            body: JSON.stringify({ isActive: false }),
          },
        ),
        { params: Promise.resolve({ id: MISSING_SPECIALTY_ID }) },
      );

      assert.equal(response.status, 404);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual((await response.json()) as OwnerErrorResponse, {
        error: "التخصص ده مش موجود.",
        code: "NOT_FOUND",
      });
    });

    it("returns 409 CONFLICT when updating to an existing specialty name", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createOwnerSpecialtyPatchHandler({
        requireAdmin,
        getAdminClient: () =>
          makeFakeAdminClient({
            specialties: [makeSpecialtyRow()],
            updateError: { code: "23505", message: "duplicate" },
          }),
      });

      const response = await handler(
        new Request(`http://localhost/api/owner/specialties/${SPECIALTY_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ name: "أطفال" }),
        }),
        { params: Promise.resolve({ id: SPECIALTY_ID }) },
      );

      assert.equal(response.status, 409);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual((await response.json()) as OwnerErrorResponse, {
        error: "التخصص ده موجود بالفعل.",
        code: "CONFLICT",
      });
    });

    it("returns 200 with updated specialty and Cache-Control: no-store", async () => {
      const { requireAdmin } = makeRequireAdminSpy(OWNER_PROFILE);
      const handler = createOwnerSpecialtyPatchHandler({
        requireAdmin,
        getAdminClient: () =>
          makeFakeAdminClient({
            specialties: [makeSpecialtyRow()],
            doctors: [{ id: "d1", specialty_id: SPECIALTY_ID }],
          }),
      });

      const response = await handler(
        new Request(`http://localhost/api/owner/specialties/${SPECIALTY_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ description: "", isActive: false }),
        }),
        { params: Promise.resolve({ id: SPECIALTY_ID }) },
      );

      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = (await response.json()) as { specialty: OwnerSpecialty };
      assert.equal(body.specialty.description, null);
      assert.equal(body.specialty.isActive, false);
      assert.equal(body.specialty.doctorCount, 1);
    });
  });
});
