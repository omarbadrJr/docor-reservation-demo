import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { OwnerServiceError } from "@/services/owner-errors";
import type { AdminProfile, Clinic, Database } from "@/types/database";

import {
  createOwnerReceptionist,
  listClinicOptionsForReceptionists,
  listOwnerReceptionists,
  updateOwnerReceptionist,
} from "./owner-receptionists";

const OWNER_ID = "aa000000-0000-0000-0000-000000000001";
const RECEPTIONIST_1_ID = "aa000000-0000-0000-0000-000000000002";
const RECEPTIONIST_2_ID = "aa000000-0000-0000-0000-000000000003";
const CREATED_USER_ID = "aa000000-0000-0000-0000-000000000099";
const MISSING_USER_ID = "aa000000-0000-0000-0000-000000000404";

const CLINIC_1_ID = "11000000-0000-0000-0000-000000000001";
const CLINIC_2_ID = "11000000-0000-0000-0000-000000000002";
const MISSING_CLINIC_ID = "11000000-0000-0000-0000-000000000999";

type DbError = { code?: string; message?: string; details?: string } | null;

type FakeAdminDataset = {
  admin_profiles: AdminProfile[];
  clinics: Clinic[];
};

function makeClinicRow(overrides: Partial<Clinic> = {}): Clinic {
  return {
    id: CLINIC_1_ID,
    name: "عيادة النيل التخصصية",
    address: "شارع الجمهورية، دمنهور، البحيرة",
    phone: "0453311223",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeAdminProfileRow(
  overrides: Partial<AdminProfile> = {},
): AdminProfile {
  return {
    id: RECEPTIONIST_1_ID,
    name: "منى إبراهيم",
    email: "mona@beheira-demo.example",
    role: "RECEPTIONIST",
    clinic_id: CLINIC_1_ID,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeFakeAdminClient(
  initialData: FakeAdminDataset,
  options?: {
    listAdminProfilesError?: DbError;
    clinicsQueryError?: DbError;
    insertProfileError?: DbError;
    throwOnInsert?: boolean;
    updateProfileError?: DbError;
    createUserResult?: {
      data: { user: { id: string } | null };
      error: { code?: string; message?: string } | null;
    };
    deleteUserError?: { message: string } | null;
    throwOnDeleteUser?: boolean;
  },
) {
  const state: FakeAdminDataset = {
    admin_profiles: initialData.admin_profiles.map((row) => ({ ...row })),
    clinics: initialData.clinics.map((row) => ({ ...row })),
  };

  const queriedTables: string[] = [];
  const createUserCalls: Array<{
    email: string;
    password: string;
    email_confirm?: boolean;
    user_metadata?: Record<string, unknown>;
  }> = [];
  const deleteUserCalls: string[] = [];

  const client = {
    from(table: keyof FakeAdminDataset) {
      queriedTables.push(table);
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

      async function executeList(): Promise<{
        data: Record<string, unknown>[] | null;
        error: DbError;
      }> {
        if (table === "admin_profiles" && options?.listAdminProfilesError) {
          return { data: null, error: options.listAdminProfilesError };
        }
        if (table === "clinics" && options?.clinicsQueryError) {
          return { data: null, error: options.clinicsQueryError };
        }

        const rows = state[table] as unknown as Record<string, unknown>[];
        return { data: applyFilters(rows), error: null };
      }

      async function executeMutationOrSingle(
        singleRequired: boolean,
      ): Promise<{ data: Record<string, unknown> | null; error: DbError }> {
        if (table === "admin_profiles" && mode === "insert") {
          if (options?.throwOnInsert) {
            throw new Error("Unexpected network reset during insert");
          }
          if (options?.insertProfileError) {
            return { data: null, error: options.insertProfileError };
          }
          const created: AdminProfile = {
            id: String(insertPayload?.id),
            name: String(insertPayload?.name),
            email: String(insertPayload?.email),
            role: insertPayload?.role as AdminProfile["role"],
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
          if (options?.updateProfileError) {
            return { data: null, error: options.updateProfileError };
          }
          const matchedIndices: number[] = [];
          state.admin_profiles.forEach((row, index) => {
            if (
              filters.every((fn) => fn(row as unknown as Record<string, unknown>))
            ) {
              matchedIndices.push(index);
            }
          });

          if (matchedIndices.length === 0) {
            return singleRequired
              ? { data: null, error: { code: "PGRST116", message: "Not found" } }
              : { data: null, error: null };
          }

          const targetIndex = matchedIndices[0];
          const updated: AdminProfile = {
            ...state.admin_profiles[targetIndex],
            ...(updatePayload as Partial<AdminProfile>),
            updated_at: "2026-02-02T12:00:00Z",
          };
          state.admin_profiles[targetIndex] = updated;
          return { data: { ...updated }, error: null };
        }

        if (table === "clinics" && options?.clinicsQueryError) {
          return { data: null, error: options.clinicsQueryError };
        }
        if (table === "admin_profiles" && options?.listAdminProfilesError) {
          return { data: null, error: options.listAdminProfilesError };
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
        maybeSingle: () => executeMutationOrSingle(false),
        single: () => executeMutationOrSingle(true),
        then: (
          onFulfilled: (value: {
            data: Record<string, unknown>[] | null;
            error: DbError;
          }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => executeList().then(onFulfilled, onRejected),
      };

      return builder;
    },
    auth: {
      admin: {
        createUser: async (params: {
          email: string;
          password: string;
          email_confirm?: boolean;
          user_metadata?: Record<string, unknown>;
        }) => {
          createUserCalls.push(params);
          if (options?.createUserResult) {
            return options.createUserResult;
          }
          return {
            data: { user: { id: CREATED_USER_ID } },
            error: null,
          };
        },
        deleteUser: async (userId: string) => {
          deleteUserCalls.push(userId);
          if (options?.throwOnDeleteUser) {
            throw new Error("Auth delete failed");
          }
          return {
            data: { user: null },
            error: options?.deleteUserError ?? null,
          };
        },
      },
    },
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    state,
    queriedTables,
    createUserCalls,
    deleteUserCalls,
  };
}

describe("owner-receptionists service", () => {
  describe("listOwnerReceptionists", () => {
    it("returns only RECEPTIONIST accounts ordered by name with clinic hydration", async () => {
      const { client } = makeFakeAdminClient({
        admin_profiles: [
          makeAdminProfileRow({
            id: OWNER_ID,
            name: "أحمد شريف",
            email: "owner@beheira-demo.example",
            role: "OWNER",
            clinic_id: null,
          }),
          makeAdminProfileRow({
            id: RECEPTIONIST_2_ID,
            name: "ياسر محمود",
            email: "yasser@beheira-demo.example",
            clinic_id: CLINIC_2_ID,
            is_active: false,
          }),
          makeAdminProfileRow({
            id: RECEPTIONIST_1_ID,
            name: "أمل علي",
            email: "amal@beheira-demo.example",
            clinic_id: CLINIC_1_ID,
            is_active: true,
          }),
        ],
        clinics: [
          makeClinicRow({ id: CLINIC_1_ID, name: "عيادة النيل", is_active: true }),
          makeClinicRow({
            id: CLINIC_2_ID,
            name: "عيادة الشاطئ",
            is_active: false,
          }),
        ],
      });

      const receptionists = await listOwnerReceptionists(client);

      assert.equal(receptionists.length, 2);
      assert.deepEqual(
        receptionists.map((item) => ({
          id: item.id,
          name: item.name,
          clinicName: item.clinicName,
          clinicIsActive: item.clinicIsActive,
          isActive: item.isActive,
        })),
        [
          {
            id: RECEPTIONIST_1_ID,
            name: "أمل علي",
            clinicName: "عيادة النيل",
            clinicIsActive: true,
            isActive: true,
          },
          {
            id: RECEPTIONIST_2_ID,
            name: "ياسر محمود",
            clinicName: "عيادة الشاطئ",
            clinicIsActive: false,
            isActive: false,
          },
        ],
      );
    });

    it("returns empty array without querying clinics when no receptionists exist", async () => {
      const { client, queriedTables } = makeFakeAdminClient({
        admin_profiles: [
          makeAdminProfileRow({
            id: OWNER_ID,
            role: "OWNER",
            clinic_id: null,
          }),
        ],
        clinics: [makeClinicRow()],
      });

      const receptionists = await listOwnerReceptionists(client);

      assert.deepEqual(receptionists, []);
      assert.deepEqual(queriedTables, ["admin_profiles"]);
    });

    it("maps database query failures to 500 OwnerServiceError", async () => {
      const { client } = makeFakeAdminClient(
        { admin_profiles: [], clinics: [] },
        { listAdminProfilesError: { message: "connection lost" } },
      );

      await assert.rejects(
        () => listOwnerReceptionists(client),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 500 &&
          err.code === "INTERNAL_ERROR",
      );
    });
  });

  describe("listClinicOptionsForReceptionists", () => {
    it("returns clinics ordered by name with active state", async () => {
      const { client } = makeFakeAdminClient({
        admin_profiles: [],
        clinics: [
          makeClinicRow({ id: CLINIC_2_ID, name: "عيادة الشاطئ", is_active: false }),
          makeClinicRow({ id: CLINIC_1_ID, name: "عيادة النيل", is_active: true }),
        ],
      });

      const options = await listClinicOptionsForReceptionists(client);

      assert.deepEqual(options, [
        { id: CLINIC_2_ID, name: "عيادة الشاطئ", isActive: false },
        { id: CLINIC_1_ID, name: "عيادة النيل", isActive: true },
      ]);
    });
  });

  describe("createOwnerReceptionist", () => {
    it("creates Auth user and admin_profiles row and returns hydrated receptionist", async () => {
      const { client, state, createUserCalls, deleteUserCalls } =
        makeFakeAdminClient({
          admin_profiles: [],
          clinics: [makeClinicRow({ id: CLINIC_1_ID, name: "عيادة النيل" })],
        });

      const created = await createOwnerReceptionist(client, {
        name: "  سارة حسن  ",
        email: "  Sara.Hassan@Beheira-Demo.Example ",
        password: "Password!2026",
        clinicId: CLINIC_1_ID,
      });

      assert.equal(createUserCalls.length, 1);
      assert.deepEqual(createUserCalls[0], {
        email: "sara.hassan@beheira-demo.example",
        password: "Password!2026",
        email_confirm: true,
        user_metadata: {
          name: "سارة حسن",
          role: "RECEPTIONIST",
        },
      });
      assert.equal(deleteUserCalls.length, 0);
      assert.equal(state.admin_profiles.length, 1);
      assert.equal(created.id, CREATED_USER_ID);
      assert.equal(created.name, "سارة حسن");
      assert.equal(created.email, "sara.hassan@beheira-demo.example");
      assert.equal(created.clinicId, CLINIC_1_ID);
      assert.equal(created.clinicName, "عيادة النيل");
      assert.equal(created.clinicIsActive, true);
      assert.equal(created.isActive, true);
    });

    it("throws 400 VALIDATION_ERROR when clinicId does not exist without creating Auth user", async () => {
      const { client, createUserCalls } = makeFakeAdminClient({
        admin_profiles: [],
        clinics: [makeClinicRow()],
      });

      await assert.rejects(
        () =>
          createOwnerReceptionist(client, {
            name: "سارة حسن",
            email: "sara@beheira-demo.example",
            password: "Password!2026",
            clinicId: MISSING_CLINIC_ID,
          }),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 400 &&
          err.code === "VALIDATION_ERROR" &&
          err.fieldErrors?.clinicId === "العيادة المختارة مش موجودة.",
      );

      assert.equal(createUserCalls.length, 0);
    });

    it("throws 409 CONFLICT when email already exists in admin_profiles without calling createUser", async () => {
      const { client, createUserCalls } = makeFakeAdminClient({
        admin_profiles: [
          makeAdminProfileRow({ email: "sara@beheira-demo.example" }),
        ],
        clinics: [makeClinicRow()],
      });

      await assert.rejects(
        () =>
          createOwnerReceptionist(client, {
            name: "سارة حسن",
            email: "SARA@beheira-demo.example",
            password: "Password!2026",
            clinicId: CLINIC_1_ID,
          }),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 409 &&
          err.code === "CONFLICT" &&
          err.message === "البريد الإلكتروني ده مستخدم لحساب تاني بالفعل." &&
          err.fieldErrors?.email ===
            "البريد الإلكتروني ده مستخدم لحساب تاني بالفعل.",
      );

      assert.equal(createUserCalls.length, 0);
    });

    it("maps Supabase Auth duplicate email errors to 409 CONFLICT", async () => {
      const { client, deleteUserCalls } = makeFakeAdminClient(
        {
          admin_profiles: [],
          clinics: [makeClinicRow()],
        },
        {
          createUserResult: {
            data: { user: null },
            error: {
              code: "email_exists",
              message: "A user with this email address has already been registered",
            },
          },
        },
      );

      await assert.rejects(
        () =>
          createOwnerReceptionist(client, {
            name: "سارة حسن",
            email: "sara@beheira-demo.example",
            password: "Password!2026",
            clinicId: CLINIC_1_ID,
          }),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 409 &&
          err.code === "CONFLICT" &&
          err.fieldErrors?.email ===
            "البريد الإلكتروني ده مستخدم لحساب تاني بالفعل.",
      );

      assert.equal(deleteUserCalls.length, 0);
    });

    it("rolls back Auth user via deleteUser when admin_profiles insert fails", async () => {
      const { client, state, deleteUserCalls } = makeFakeAdminClient(
        {
          admin_profiles: [],
          clinics: [makeClinicRow()],
        },
        {
          insertProfileError: {
            code: "23505",
            message: "duplicate key value violates unique constraint",
          },
        },
      );

      await assert.rejects(
        () =>
          createOwnerReceptionist(client, {
            name: "سارة حسن",
            email: "sara@beheira-demo.example",
            password: "Password!2026",
            clinicId: CLINIC_1_ID,
          }),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 409 &&
          err.code === "CONFLICT",
      );

      assert.deepEqual(deleteUserCalls, [CREATED_USER_ID]);
      assert.equal(state.admin_profiles.length, 0);
    });

    it("still throws original mapped DB error even if Auth deleteUser rollback throws", async () => {
      const { client, deleteUserCalls } = makeFakeAdminClient(
        {
          admin_profiles: [],
          clinics: [makeClinicRow()],
        },
        {
          insertProfileError: {
            code: "42501",
            message: "permission denied",
          },
          throwOnDeleteUser: true,
        },
      );

      await assert.rejects(
        () =>
          createOwnerReceptionist(client, {
            name: "سارة حسن",
            email: "sara@beheira-demo.example",
            password: "Password!2026",
            clinicId: CLINIC_1_ID,
          }),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 500 &&
          err.code === "INTERNAL_ERROR",
      );

      assert.deepEqual(deleteUserCalls, [CREATED_USER_ID]);
    });

    it("rolls back Auth user when admin_profiles insert rejects unexpectedly", async () => {
      const { client, deleteUserCalls } = makeFakeAdminClient(
        {
          admin_profiles: [],
          clinics: [makeClinicRow()],
        },
        {
          throwOnInsert: true,
        },
      );

      await assert.rejects(
        () =>
          createOwnerReceptionist(client, {
            name: "سارة حسن",
            email: "sara@beheira-demo.example",
            password: "Password!2026",
            clinicId: CLINIC_1_ID,
          }),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 500 &&
          err.code === "INTERNAL_ERROR",
      );

      assert.deepEqual(deleteUserCalls, [CREATED_USER_ID]);
    });
  });

  describe("updateOwnerReceptionist", () => {
    it("updates receptionist name, assigned clinic, and active status", async () => {
      const { client } = makeFakeAdminClient({
        admin_profiles: [
          makeAdminProfileRow({
            id: RECEPTIONIST_1_ID,
            name: "منى إبراهيم",
            clinic_id: CLINIC_1_ID,
            is_active: true,
          }),
        ],
        clinics: [
          makeClinicRow({ id: CLINIC_1_ID, name: "عيادة النيل" }),
          makeClinicRow({
            id: CLINIC_2_ID,
            name: "عيادة الشاطئ",
            is_active: false,
          }),
        ],
      });

      const updatedDetails = await updateOwnerReceptionist(
        client,
        RECEPTIONIST_1_ID,
        {
          name: "منى إبراهيم محمد",
          clinicId: CLINIC_2_ID,
        },
      );

      assert.equal(updatedDetails.name, "منى إبراهيم محمد");
      assert.equal(updatedDetails.clinicId, CLINIC_2_ID);
      assert.equal(updatedDetails.clinicName, "عيادة الشاطئ");
      assert.equal(updatedDetails.clinicIsActive, false);
      assert.equal(updatedDetails.isActive, true);

      const deactivated = await updateOwnerReceptionist(
        client,
        RECEPTIONIST_1_ID,
        { isActive: false },
      );
      assert.equal(deactivated.isActive, false);
      assert.equal(deactivated.clinicName, "عيادة الشاطئ");

      const reactivated = await updateOwnerReceptionist(
        client,
        RECEPTIONIST_1_ID,
        { isActive: true },
      );
      assert.equal(reactivated.isActive, true);
    });

    it("refuses with 404 NOT_FOUND when attempting to modify an OWNER profile", async () => {
      const { client, state } = makeFakeAdminClient({
        admin_profiles: [
          makeAdminProfileRow({
            id: OWNER_ID,
            name: "أحمد شريف",
            email: "owner@beheira-demo.example",
            role: "OWNER",
            clinic_id: null,
            is_active: true,
          }),
        ],
        clinics: [makeClinicRow()],
      });

      await assert.rejects(
        () =>
          updateOwnerReceptionist(client, OWNER_ID, {
            isActive: false,
            clinicId: CLINIC_1_ID,
          }),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 404 &&
          err.code === "NOT_FOUND" &&
          err.message === "حساب موظف الاستقبال ده مش موجود.",
      );

      assert.equal(state.admin_profiles[0]?.role, "OWNER");
      assert.equal(state.admin_profiles[0]?.is_active, true);
      assert.equal(state.admin_profiles[0]?.clinic_id, null);
    });

    it("throws 404 NOT_FOUND when receptionist does not exist", async () => {
      const { client } = makeFakeAdminClient({
        admin_profiles: [],
        clinics: [makeClinicRow()],
      });

      await assert.rejects(
        () =>
          updateOwnerReceptionist(client, MISSING_USER_ID, {
            isActive: false,
          }),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 404 &&
          err.code === "NOT_FOUND",
      );
    });

    it("throws 400 VALIDATION_ERROR when target clinicId does not exist", async () => {
      const { client, state } = makeFakeAdminClient({
        admin_profiles: [makeAdminProfileRow()],
        clinics: [makeClinicRow()],
      });

      await assert.rejects(
        () =>
          updateOwnerReceptionist(client, RECEPTIONIST_1_ID, {
            clinicId: MISSING_CLINIC_ID,
          }),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 400 &&
          err.code === "VALIDATION_ERROR" &&
          err.fieldErrors?.clinicId === "العيادة المختارة مش موجودة.",
      );

      assert.equal(state.admin_profiles[0]?.clinic_id, CLINIC_1_ID);
    });
  });
});
