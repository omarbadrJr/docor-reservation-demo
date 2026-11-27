import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { PATCH as patchRoute } from "@/app/api/owner/receptionists/[id]/route";
import { GET as getRoute, POST as postRoute } from "@/app/api/owner/receptionists/route";
import { assertRole } from "@/services/auth";
import {
  createOwnerReceptionistPatchHandler,
  createOwnerReceptionistsGetHandler,
  createOwnerReceptionistsPostHandler,
} from "@/services/owner-receptionists";
import type { StaffProfile } from "@/types/auth";
import type { AdminProfile, AdminRole, Clinic, Database } from "@/types/database";
import type { OwnerErrorResponse, OwnerReceptionist } from "@/types/owner";

const OWNER_ID = "aa000000-0000-0000-0000-000000000001";
const RECEPTIONIST_ID = "aa000000-0000-0000-0000-000000000002";
const CREATED_USER_ID = "aa000000-0000-0000-0000-000000000077";
const CLINIC_1_ID = "11000000-0000-0000-0000-000000000001";
const CLINIC_2_ID = "11000000-0000-0000-0000-000000000002";
const MISSING_CLINIC_ID = "11000000-0000-0000-0000-000000000999";

const OWNER_PROFILE: StaffProfile = {
  id: OWNER_ID,
  name: "أحمد شريف",
  email: "owner@beheira-demo.example",
  role: "OWNER",
  clinicId: null,
  clinicName: null,
  isActive: true,
};

const RECEPTIONIST_PROFILE: StaffProfile = {
  id: RECEPTIONIST_ID,
  name: "منى إبراهيم",
  email: "mona@beheira-demo.example",
  role: "RECEPTIONIST",
  clinicId: CLINIC_1_ID,
  clinicName: "عيادة النيل",
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

function makeFakeAdminClient(
  initialData: {
    admin_profiles: AdminProfile[];
    clinics: Clinic[];
  },
  options?: {
    insertProfileError?: { code?: string; message?: string } | null;
  },
) {
  const state = {
    admin_profiles: initialData.admin_profiles.map((row) => ({ ...row })),
    clinics: initialData.clinics.map((row) => ({ ...row })),
  };
  const deleteUserCalls: string[] = [];

  const client = {
    from(table: "admin_profiles" | "clinics") {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      let orderConfig: { column: string; ascending: boolean } | null = null;
      let mode: "select" | "insert" | "update" = "select";
      let insertPayload: Record<string, unknown> | null = null;
      let updatePayload: Record<string, unknown> | null = null;

      function applyFilters(rows: Record<string, unknown>[]) {
        let result = rows.filter((row) => filters.every((fn) => fn(row)));
        if (orderConfig) {
          const { column, ascending } = orderConfig;
          result = [...result].sort((a, b) => {
            const av = String(a[column] ?? "");
            const bv = String(b[column] ?? "");
            return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
          });
        }
        return result;
      }

      async function runSingle(singleRequired: boolean) {
        if (table === "admin_profiles" && mode === "insert") {
          if (options?.insertProfileError) {
            return { data: null, error: options.insertProfileError };
          }
          const created: AdminProfile = {
            id: String(insertPayload?.id),
            name: String(insertPayload?.name),
            email: String(insertPayload?.email),
            role: insertPayload?.role as AdminRole,
            clinic_id:
              insertPayload?.clinic_id === null
                ? null
                : String(insertPayload?.clinic_id),
            is_active: Boolean(insertPayload?.is_active ?? true),
            created_at: "2026-02-01T10:00:00Z",
            updated_at: "2026-02-01T10:00:00Z",
          };
          state.admin_profiles.push(created);
          return { data: { ...created }, error: null };
        }

        if (table === "admin_profiles" && mode === "update") {
          const matched = state.admin_profiles.findIndex((row) =>
            filters.every((fn) => fn(row as unknown as Record<string, unknown>)),
          );
          if (matched === -1) {
            return singleRequired
              ? { data: null, error: { code: "PGRST116", message: "Not found" } }
              : { data: null, error: null };
          }

          const updated: AdminProfile = {
            ...state.admin_profiles[matched],
            ...(updatePayload as Partial<AdminProfile>),
            updated_at: "2026-02-02T12:00:00Z",
          };
          state.admin_profiles[matched] = updated;
          return { data: { ...updated }, error: null };
        }

        const rows = applyFilters(
          state[table] as unknown as Record<string, unknown>[],
        );
        if (rows.length === 0) {
          return singleRequired
            ? { data: null, error: { code: "PGRST116", message: "Not found" } }
            : { data: null, error: null };
        }

        return { data: { ...rows[0] }, error: null };
      }

      const builder = {
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
        eq: (column: string, value: unknown) => {
          filters.push((row) => row[column] === value);
          return builder;
        },
        in: (column: string, values: unknown[]) => {
          filters.push((row) => values.includes(row[column]));
          return builder;
        },
        order: (column: string, opts?: { ascending?: boolean }) => {
          orderConfig = { column, ascending: opts?.ascending ?? true };
          return builder;
        },
        maybeSingle: () => runSingle(false),
        single: () => runSingle(true),
        then: (
          onFulfilled: (val: {
            data: Record<string, unknown>[];
            error: null;
          }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) =>
          Promise.resolve({
            data: applyFilters(
              state[table] as unknown as Record<string, unknown>[],
            ),
            error: null,
          }).then(onFulfilled, onRejected),
      };

      return builder;
    },
    auth: {
      admin: {
        createUser: async () => ({
          data: { user: { id: CREATED_USER_ID } },
          error: null,
        }),
        deleteUser: async (userId: string) => {
          deleteUserCalls.push(userId);
          return { data: { user: null }, error: null };
        },
      },
    },
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    state,
    deleteUserCalls,
  };
}

function makeDefaultDataset() {
  return {
    admin_profiles: [
      {
        id: OWNER_ID,
        name: "أحمد شريف",
        email: "owner@beheira-demo.example",
        role: "OWNER" as const,
        clinic_id: null,
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: RECEPTIONIST_ID,
        name: "منى إبراهيم",
        email: "mona@beheira-demo.example",
        role: "RECEPTIONIST" as const,
        clinic_id: CLINIC_1_ID,
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    clinics: [
      {
        id: CLINIC_1_ID,
        name: "عيادة النيل",
        address: "شارع الجمهورية، دمنهور",
        phone: "0453311223",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: CLINIC_2_ID,
        name: "عيادة الشاطئ",
        address: "شارع البحر، دمنهور",
        phone: "0453311224",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
  };
}

describe("Owner receptionists API routes", () => {
  it("exports Next.js GET, POST, and PATCH handlers", () => {
    assert.equal(typeof getRoute, "function");
    assert.equal(typeof postRoute, "function");
    assert.equal(typeof patchRoute, "function");
  });

  describe("GET /api/owner/receptionists", () => {
    it("returns 401 UNAUTHORIZED with Cache-Control: no-store when unauthenticated", async () => {
      const { requireAdmin, requestedRoles } = makeRequireAdmin(null);
      const { client } = makeFakeAdminClient(makeDefaultDataset());
      const handler = createOwnerReceptionistsGetHandler({
        requireAdmin,
        getAdminClient: () => client,
      });

      const response = await handler();

      assert.equal(response.status, 401);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(requestedRoles, [["OWNER"]]);
      const body = (await response.json()) as OwnerErrorResponse;
      assert.equal(body.code, "UNAUTHORIZED");
    });

    it("returns 403 FORBIDDEN with Cache-Control: no-store when called by a receptionist", async () => {
      const { requireAdmin } = makeRequireAdmin(RECEPTIONIST_PROFILE);
      const { client } = makeFakeAdminClient(makeDefaultDataset());
      const handler = createOwnerReceptionistsGetHandler({
        requireAdmin,
        getAdminClient: () => client,
      });

      const response = await handler();

      assert.equal(response.status, 403);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = (await response.json()) as OwnerErrorResponse;
      assert.equal(body.code, "FORBIDDEN");
    });

    it("returns 200 with receptionists list (excluding OWNER) and Cache-Control: no-store", async () => {
      const { requireAdmin } = makeRequireAdmin(OWNER_PROFILE);
      const { client } = makeFakeAdminClient(makeDefaultDataset());
      const handler = createOwnerReceptionistsGetHandler({
        requireAdmin,
        getAdminClient: () => client,
      });

      const response = await handler();

      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = (await response.json()) as {
        receptionists: OwnerReceptionist[];
      };
      assert.equal(body.receptionists.length, 1);
      assert.equal(body.receptionists[0]?.id, RECEPTIONIST_ID);
      assert.equal(body.receptionists[0]?.clinicName, "عيادة النيل");
    });
  });

  describe("POST /api/owner/receptionists", () => {
    it("enforces OWNER RBAC (401/403) with Cache-Control: no-store", async () => {
      const { client } = makeFakeAdminClient(makeDefaultDataset());

      const unauthHandler = createOwnerReceptionistsPostHandler({
        requireAdmin: makeRequireAdmin(null).requireAdmin,
        getAdminClient: () => client,
      });
      const unauthResponse = await unauthHandler(
        new Request("http://localhost/api/owner/receptionists", {
          method: "POST",
          body: JSON.stringify({}),
        }),
      );
      assert.equal(unauthResponse.status, 401);
      assert.equal(unauthResponse.headers.get("cache-control"), "no-store");

      const forbiddenHandler = createOwnerReceptionistsPostHandler({
        requireAdmin: makeRequireAdmin(RECEPTIONIST_PROFILE).requireAdmin,
        getAdminClient: () => client,
      });
      const forbiddenResponse = await forbiddenHandler(
        new Request("http://localhost/api/owner/receptionists", {
          method: "POST",
          body: JSON.stringify({}),
        }),
      );
      assert.equal(forbiddenResponse.status, 403);
      assert.equal(forbiddenResponse.headers.get("cache-control"), "no-store");
    });

    it("returns 400 VALIDATION_ERROR on invalid JSON or invalid input fields", async () => {
      const { client } = makeFakeAdminClient(makeDefaultDataset());
      const handler = createOwnerReceptionistsPostHandler({
        requireAdmin: makeRequireAdmin(OWNER_PROFILE).requireAdmin,
        getAdminClient: () => client,
      });

      const badJsonRes = await handler(
        new Request("http://localhost/api/owner/receptionists", {
          method: "POST",
          body: "{not-json",
        }),
      );
      assert.equal(badJsonRes.status, 400);
      assert.equal(badJsonRes.headers.get("cache-control"), "no-store");

      const invalidFieldsRes = await handler(
        new Request("http://localhost/api/owner/receptionists", {
          method: "POST",
          body: JSON.stringify({
            name: "س",
            email: "bad-email",
            password: "123",
            clinicId: "not-a-uuid",
          }),
        }),
      );
      assert.equal(invalidFieldsRes.status, 400);
      assert.equal(invalidFieldsRes.headers.get("cache-control"), "no-store");
      const body = (await invalidFieldsRes.json()) as OwnerErrorResponse;
      assert.equal(body.code, "VALIDATION_ERROR");
      assert.ok(body.fieldErrors?.name);
      assert.ok(body.fieldErrors?.email);
      assert.ok(body.fieldErrors?.password);
      assert.ok(body.fieldErrors?.clinicId);
    });

    it("returns 400 when clinicId does not exist and 409 on duplicate email", async () => {
      const { client } = makeFakeAdminClient(makeDefaultDataset());
      const handler = createOwnerReceptionistsPostHandler({
        requireAdmin: makeRequireAdmin(OWNER_PROFILE).requireAdmin,
        getAdminClient: () => client,
      });

      const missingClinicRes = await handler(
        new Request("http://localhost/api/owner/receptionists", {
          method: "POST",
          body: JSON.stringify({
            name: "سارة حسن",
            email: "sara@beheira-demo.example",
            password: "Password!2026",
            clinicId: MISSING_CLINIC_ID,
          }),
        }),
      );
      assert.equal(missingClinicRes.status, 400);
      assert.equal(missingClinicRes.headers.get("cache-control"), "no-store");

      const dupEmailRes = await handler(
        new Request("http://localhost/api/owner/receptionists", {
          method: "POST",
          body: JSON.stringify({
            name: "سارة حسن",
            email: "mona@beheira-demo.example",
            password: "Password!2026",
            clinicId: CLINIC_1_ID,
          }),
        }),
      );
      assert.equal(dupEmailRes.status, 409);
      assert.equal(dupEmailRes.headers.get("cache-control"), "no-store");
      const dupBody = (await dupEmailRes.json()) as OwnerErrorResponse;
      assert.equal(dupBody.code, "CONFLICT");
    });

    it("triggers Auth user rollback and returns 500 if admin_profiles insert fails", async () => {
      const { client, deleteUserCalls } = makeFakeAdminClient(
        makeDefaultDataset(),
        {
          insertProfileError: {
            code: "42501",
            message: "insert blocked",
          },
        },
      );
      const handler = createOwnerReceptionistsPostHandler({
        requireAdmin: makeRequireAdmin(OWNER_PROFILE).requireAdmin,
        getAdminClient: () => client,
      });

      const response = await handler(
        new Request("http://localhost/api/owner/receptionists", {
          method: "POST",
          body: JSON.stringify({
            name: "سارة حسن",
            email: "sara@beheira-demo.example",
            password: "Password!2026",
            clinicId: CLINIC_1_ID,
          }),
        }),
      );

      assert.equal(response.status, 500);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(deleteUserCalls, [CREATED_USER_ID]);
    });

    it("returns 201 with created receptionist (without password) and Cache-Control: no-store", async () => {
      const { client } = makeFakeAdminClient(makeDefaultDataset());
      const handler = createOwnerReceptionistsPostHandler({
        requireAdmin: makeRequireAdmin(OWNER_PROFILE).requireAdmin,
        getAdminClient: () => client,
      });

      const response = await handler(
        new Request("http://localhost/api/owner/receptionists", {
          method: "POST",
          body: JSON.stringify({
            name: "سارة حسن",
            email: "Sara@Beheira-Demo.Example",
            password: "Password!2026",
            clinicId: CLINIC_2_ID,
          }),
        }),
      );

      assert.equal(response.status, 201);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = (await response.json()) as {
        receptionist: OwnerReceptionist & Record<string, unknown>;
      };
      assert.equal(body.receptionist.id, CREATED_USER_ID);
      assert.equal(body.receptionist.email, "sara@beheira-demo.example");
      assert.equal(body.receptionist.clinicName, "عيادة الشاطئ");
      assert.equal("password" in body.receptionist, false);
    });
  });

  describe("PATCH /api/owner/receptionists/[id]", () => {
    it("enforces OWNER RBAC (401/403) with Cache-Control: no-store", async () => {
      const { client } = makeFakeAdminClient(makeDefaultDataset());

      const unauthHandler = createOwnerReceptionistPatchHandler({
        requireAdmin: makeRequireAdmin(null).requireAdmin,
        getAdminClient: () => client,
      });
      const unauthRes = await unauthHandler(
        new Request(`http://localhost/api/owner/receptionists/${RECEPTIONIST_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: false }),
        }),
        RECEPTIONIST_ID,
      );
      assert.equal(unauthRes.status, 401);
      assert.equal(unauthRes.headers.get("cache-control"), "no-store");

      const forbiddenHandler = createOwnerReceptionistPatchHandler({
        requireAdmin: makeRequireAdmin(RECEPTIONIST_PROFILE).requireAdmin,
        getAdminClient: () => client,
      });
      const forbiddenRes = await forbiddenHandler(
        new Request(`http://localhost/api/owner/receptionists/${RECEPTIONIST_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: false }),
        }),
        RECEPTIONIST_ID,
      );
      assert.equal(forbiddenRes.status, 403);
      assert.equal(forbiddenRes.headers.get("cache-control"), "no-store");
    });

    it("returns 400 on invalid UUID or empty body", async () => {
      const { client } = makeFakeAdminClient(makeDefaultDataset());
      const handler = createOwnerReceptionistPatchHandler({
        requireAdmin: makeRequireAdmin(OWNER_PROFILE).requireAdmin,
        getAdminClient: () => client,
      });

      const badUuidRes = await handler(
        new Request("http://localhost/api/owner/receptionists/bad-id", {
          method: "PATCH",
          body: JSON.stringify({ isActive: false }),
        }),
        "bad-id",
      );
      assert.equal(badUuidRes.status, 400);
      assert.equal(badUuidRes.headers.get("cache-control"), "no-store");

      const emptyBodyRes = await handler(
        new Request(`http://localhost/api/owner/receptionists/${RECEPTIONIST_ID}`, {
          method: "PATCH",
          body: JSON.stringify({}),
        }),
        RECEPTIONIST_ID,
      );
      assert.equal(emptyBodyRes.status, 400);
      assert.equal(emptyBodyRes.headers.get("cache-control"), "no-store");
    });

    it("returns 404 NOT_FOUND when attempting to patch an OWNER account", async () => {
      const { client, state } = makeFakeAdminClient(makeDefaultDataset());
      const handler = createOwnerReceptionistPatchHandler({
        requireAdmin: makeRequireAdmin(OWNER_PROFILE).requireAdmin,
        getAdminClient: () => client,
      });

      const response = await handler(
        new Request(`http://localhost/api/owner/receptionists/${OWNER_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: false }),
        }),
        OWNER_ID,
      );

      assert.equal(response.status, 404);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = (await response.json()) as OwnerErrorResponse;
      assert.equal(body.code, "NOT_FOUND");
      assert.equal(state.admin_profiles[0]?.is_active, true);
    });

    it("updates details and toggles active status with 200 and Cache-Control: no-store", async () => {
      const { client } = makeFakeAdminClient(makeDefaultDataset());
      const handler = createOwnerReceptionistPatchHandler({
        requireAdmin: makeRequireAdmin(OWNER_PROFILE).requireAdmin,
        getAdminClient: () => client,
      });

      const editRes = await handler(
        new Request(`http://localhost/api/owner/receptionists/${RECEPTIONIST_ID}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: "منى إبراهيم حسن",
            clinicId: CLINIC_2_ID,
          }),
        }),
        RECEPTIONIST_ID,
      );
      assert.equal(editRes.status, 200);
      assert.equal(editRes.headers.get("cache-control"), "no-store");
      const editBody = (await editRes.json()) as {
        receptionist: OwnerReceptionist;
      };
      assert.equal(editBody.receptionist.name, "منى إبراهيم حسن");
      assert.equal(editBody.receptionist.clinicId, CLINIC_2_ID);
      assert.equal(editBody.receptionist.clinicName, "عيادة الشاطئ");

      const deactivateRes = await handler(
        new Request(`http://localhost/api/owner/receptionists/${RECEPTIONIST_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: false }),
        }),
        RECEPTIONIST_ID,
      );
      assert.equal(deactivateRes.status, 200);
      assert.equal(deactivateRes.headers.get("cache-control"), "no-store");
      const deactivateBody = (await deactivateRes.json()) as {
        receptionist: OwnerReceptionist;
      };
      assert.equal(deactivateBody.receptionist.isActive, false);
    });
  });
});
