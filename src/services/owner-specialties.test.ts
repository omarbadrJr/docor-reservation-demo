import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Specialty } from "@/types/database";

import { OwnerServiceError } from "./owner-errors";
import {
  createOwnerSpecialty,
  listOwnerSpecialties,
  updateOwnerSpecialty,
} from "./owner-specialties";

const SPECIALTY_A_ID = "22000000-0000-0000-0000-000000000001";
const SPECIALTY_B_ID = "22000000-0000-0000-0000-000000000002";
const MISSING_SPECIALTY_ID = "22000000-0000-0000-0000-000000000099";

type DbError = { code?: string; message: string; details?: string } | null;

function makeSpecialtyRow(overrides: Partial<Specialty> = {}): Specialty {
  return {
    id: SPECIALTY_A_ID,
    name: "باطنة",
    description: "أمراض الباطنة العامة والضغط والسكر",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeFakeAdminClient(options: {
  specialties?: Specialty[];
  doctors?: Array<{ id: string; specialty_id: string }>;
  specialtiesSelectError?: DbError;
  doctorsSelectError?: DbError;
  insertError?: DbError;
  updateError?: DbError;
  doctorsCountError?: DbError;
  useArrayCountFallback?: boolean;
}) {
  const specialties = [...(options.specialties ?? [])];
  const doctors = [...(options.doctors ?? [])];

  const client = {
    from(table: "specialties" | "doctors") {
      if (table === "doctors") {
        let filteredSpecialtyId: string | null = null;
        let isHead = false;

        const builder = {
          select: (
            _columns?: string,
            selectOptions?: { count?: string; head?: boolean },
          ) => {
            isHead = Boolean(selectOptions?.head);
            return builder;
          },
          eq: (column: string, value: string) => {
            if (column === "specialty_id") {
              filteredSpecialtyId = value;
            }
            return Promise.resolve().then(() => {
              if (options.doctorsCountError) {
                return {
                  data: null,
                  count: null,
                  error: options.doctorsCountError,
                };
              }
              const matching = doctors.filter(
                (doc) => doc.specialty_id === filteredSpecialtyId,
              );
              if (options.useArrayCountFallback) {
                return { data: matching, count: null, error: null };
              }
              return {
                data: isHead ? null : matching,
                count: matching.length,
                error: null,
              };
            });
          },
          then(
            onFulfilled: (value: {
              data: Array<{ specialty_id: string }> | null;
              error: DbError;
            }) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) {
            const result = options.doctorsSelectError
              ? { data: null, error: options.doctorsSelectError }
              : {
                  data: doctors.map((doc) => ({
                    specialty_id: doc.specialty_id,
                  })),
                  error: null,
                };
            return Promise.resolve(result).then(onFulfilled, onRejected);
          },
        };

        return builder;
      }

      // specialties table
      return {
        select: () => ({
          order: async (
            column: string,
            orderOptions?: { ascending?: boolean },
          ) => {
            if (options.specialtiesSelectError) {
              return { data: null, error: options.specialtiesSelectError };
            }
            const sorted = [...specialties].sort((a, b) => {
              if (column === "name") {
                const cmp = a.name.localeCompare(b.name);
                return orderOptions?.ascending === false ? -cmp : cmp;
              }
              return 0;
            });
            return { data: sorted, error: null };
          },
        }),
        insert: (payload: {
          name: string;
          description: string | null;
          is_active: boolean;
        }) => ({
          select: () => ({
            single: async () => {
              if (options.insertError) {
                return { data: null, error: options.insertError };
              }
              const row = makeSpecialtyRow({
                id: "22000000-0000-0000-0000-000000000010",
                name: payload.name,
                description: payload.description,
                is_active: payload.is_active,
              });
              specialties.push(row);
              return { data: row, error: null };
            },
          }),
        }),
        update: (updates: Partial<Specialty>) => ({
          eq: (_column: string, id: string) => ({
            select: () => ({
              maybeSingle: async () => {
                if (options.updateError) {
                  return { data: null, error: options.updateError };
                }
                const index = specialties.findIndex((item) => item.id === id);
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

describe("owner-specialties service", () => {
  describe("listOwnerSpecialties", () => {
    it("returns active and inactive specialties ordered by name with doctor counts", async () => {
      const client = makeFakeAdminClient({
        specialties: [
          makeSpecialtyRow({
            id: SPECIALTY_B_ID,
            name: "عظام",
            description: null,
            is_active: false,
          }),
          makeSpecialtyRow({
            id: SPECIALTY_A_ID,
            name: "أطفال",
            description: "متابعة الأطفال",
            is_active: true,
          }),
        ],
        doctors: [
          { id: "d1", specialty_id: SPECIALTY_A_ID },
          { id: "d2", specialty_id: SPECIALTY_A_ID },
          { id: "d3", specialty_id: SPECIALTY_B_ID },
        ],
      });

      const result = await listOwnerSpecialties(client);

      assert.equal(result.length, 2);
      assert.deepEqual(
        result.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          isActive: s.isActive,
          doctorCount: s.doctorCount,
        })),
        [
          {
            id: SPECIALTY_A_ID,
            name: "أطفال",
            description: "متابعة الأطفال",
            isActive: true,
            doctorCount: 2,
          },
          {
            id: SPECIALTY_B_ID,
            name: "عظام",
            description: null,
            isActive: false,
            doctorCount: 1,
          },
        ],
      );
    });

    it("throws 500 OwnerServiceError when database query fails", async () => {
      const specialtiesErrClient = makeFakeAdminClient({
        specialtiesSelectError: { message: "db error" },
      });
      await assert.rejects(
        () => listOwnerSpecialties(specialtiesErrClient),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 500 &&
          err.code === "INTERNAL_ERROR",
      );

      const doctorsErrClient = makeFakeAdminClient({
        specialties: [makeSpecialtyRow()],
        doctorsSelectError: { message: "doctors error" },
      });
      await assert.rejects(
        () => listOwnerSpecialties(doctorsErrClient),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 500 &&
          err.code === "INTERNAL_ERROR",
      );
    });
  });

  describe("createOwnerSpecialty", () => {
    it("creates a specialty with nullable description and doctorCount 0", async () => {
      const client = makeFakeAdminClient({});

      const created = await createOwnerSpecialty(client, {
        name: "جلدية",
        description: null,
        isActive: true,
      });

      assert.equal(created.name, "جلدية");
      assert.equal(created.description, null);
      assert.equal(created.isActive, true);
      assert.equal(created.doctorCount, 0);
    });

    it("maps 23505 duplicate name to 409 CONFLICT with Arabic message", async () => {
      const client = makeFakeAdminClient({
        insertError: {
          code: "23505",
          message: "duplicate key value violates unique constraint",
        },
      });

      await assert.rejects(
        () =>
          createOwnerSpecialty(client, {
            name: "باطنة",
            description: null,
            isActive: true,
          }),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 409 &&
          err.code === "CONFLICT" &&
          err.message === "التخصص ده موجود بالفعل.",
      );
    });
  });

  describe("updateOwnerSpecialty", () => {
    it("updates partial fields including clearing description to null and hydrates doctorCount", async () => {
      const client = makeFakeAdminClient({
        specialties: [makeSpecialtyRow()],
        doctors: [
          { id: "d1", specialty_id: SPECIALTY_A_ID },
          { id: "d2", specialty_id: SPECIALTY_A_ID },
        ],
      });

      const updated = await updateOwnerSpecialty(client, SPECIALTY_A_ID, {
        description: null,
        isActive: false,
      });

      assert.equal(updated.description, null);
      assert.equal(updated.isActive, false);
      assert.equal(updated.doctorCount, 2);
    });

    it("throws 404 NOT_FOUND when specialty does not exist (maybeSingle null or PGRST116)", async () => {
      const missingClient = makeFakeAdminClient({ specialties: [] });

      await assert.rejects(
        () =>
          updateOwnerSpecialty(missingClient, MISSING_SPECIALTY_ID, {
            name: "تخصص غير موجود",
          }),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 404 &&
          err.code === "NOT_FOUND" &&
          err.message === "التخصص ده مش موجود.",
      );

      const pgrstClient = makeFakeAdminClient({
        updateError: { code: "PGRST116", message: "0 rows" },
      });

      await assert.rejects(
        () =>
          updateOwnerSpecialty(pgrstClient, MISSING_SPECIALTY_ID, {
            name: "تخصص غير موجود",
          }),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 404 &&
          err.code === "NOT_FOUND" &&
          err.message === "التخصص ده مش موجود.",
      );
    });

    it("maps 23505 to 409 and rejects empty updates with 400", async () => {
      const conflictClient = makeFakeAdminClient({
        specialties: [makeSpecialtyRow()],
        updateError: { code: "23505", message: "duplicate name" },
      });

      await assert.rejects(
        () =>
          updateOwnerSpecialty(conflictClient, SPECIALTY_A_ID, {
            name: "أطفال",
          }),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 409 &&
          err.code === "CONFLICT" &&
          err.message === "التخصص ده موجود بالفعل.",
      );

      await assert.rejects(
        () => updateOwnerSpecialty(conflictClient, SPECIALTY_A_ID, {}),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 400 &&
          err.code === "VALIDATION_ERROR",
      );
    });
  });
});
