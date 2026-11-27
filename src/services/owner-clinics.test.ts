import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Clinic, Database } from "@/types/database";

import {
  createOwnerClinic,
  listOwnerClinics,
  updateOwnerClinic,
} from "./owner-clinics";
import { OwnerServiceError } from "./owner-errors";

const CLINIC_A_ID = "11000000-0000-0000-0000-000000000001";
const CLINIC_B_ID = "11000000-0000-0000-0000-000000000002";
const MISSING_CLINIC_ID = "11000000-0000-0000-0000-000000000099";

type DbError = { code?: string; message: string; details?: string } | null;

function makeClinicRow(overrides: Partial<Clinic> = {}): Clinic {
  return {
    id: CLINIC_A_ID,
    name: "عيادة النيل التخصصية",
    address: "شارع الجمهورية، دمنهور، البحيرة",
    phone: "0453311223",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeFakeAdminClient(options: {
  clinics?: Clinic[];
  doctors?: Array<{ id: string; clinic_id: string }>;
  clinicsSelectError?: DbError;
  doctorsSelectError?: DbError;
  insertError?: DbError;
  insertReturnNull?: boolean;
  updateError?: DbError;
  doctorsCountError?: DbError;
  useArrayCountFallback?: boolean;
}) {
  const clinics = [...(options.clinics ?? [])];
  const doctors = [...(options.doctors ?? [])];

  const client = {
    from(table: "clinics" | "doctors") {
      if (table === "doctors") {
        let filteredClinicId: string | null = null;
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
            if (column === "clinic_id") {
              filteredClinicId = value;
            }
            return Promise.resolve().then(() => {
              if (options.doctorsCountError) {
                return { data: null, count: null, error: options.doctorsCountError };
              }
              const matching = doctors.filter(
                (doc) => doc.clinic_id === filteredClinicId,
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
              data: Array<{ clinic_id: string }> | null;
              error: DbError;
            }) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) {
            const result = options.doctorsSelectError
              ? { data: null, error: options.doctorsSelectError }
              : {
                  data: doctors.map((doc) => ({ clinic_id: doc.clinic_id })),
                  error: null,
                };
            return Promise.resolve(result).then(onFulfilled, onRejected);
          },
        };

        return builder;
      }

      // clinics table
      return {
        select: () => ({
          order: async (
            column: string,
            orderOptions?: { ascending?: boolean },
          ) => {
            if (options.clinicsSelectError) {
              return { data: null, error: options.clinicsSelectError };
            }
            const sorted = [...clinics].sort((a, b) => {
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
          address: string;
          phone: string;
          is_active: boolean;
        }) => ({
          select: () => ({
            single: async () => {
              if (options.insertError) {
                return { data: null, error: options.insertError };
              }
              if (options.insertReturnNull) {
                return { data: null, error: null };
              }
              const row = makeClinicRow({
                id: "11000000-0000-0000-0000-000000000010",
                name: payload.name,
                address: payload.address,
                phone: payload.phone,
                is_active: payload.is_active,
              });
              clinics.push(row);
              return { data: row, error: null };
            },
          }),
        }),
        update: (updates: Partial<Clinic>) => ({
          eq: (_column: string, id: string) => ({
            select: () => ({
              maybeSingle: async () => {
                if (options.updateError) {
                  return { data: null, error: options.updateError };
                }
                const index = clinics.findIndex((item) => item.id === id);
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

describe("owner-clinics service", () => {
  describe("listOwnerClinics", () => {
    it("returns active and inactive clinics ordered by name with doctor counts", async () => {
      const client = makeFakeAdminClient({
        clinics: [
          makeClinicRow({
            id: CLINIC_B_ID,
            name: "مركز الشفاء الطبي",
            is_active: false,
          }),
          makeClinicRow({
            id: CLINIC_A_ID,
            name: "عيادة النيل التخصصية",
            is_active: true,
          }),
        ],
        doctors: [
          { id: "d1", clinic_id: CLINIC_A_ID },
          { id: "d2", clinic_id: CLINIC_A_ID },
        ],
      });

      const result = await listOwnerClinics(client);

      assert.equal(result.length, 2);
      assert.deepEqual(
        result.map((c) => ({
          id: c.id,
          name: c.name,
          isActive: c.isActive,
          doctorCount: c.doctorCount,
        })),
        [
          {
            id: CLINIC_A_ID,
            name: "عيادة النيل التخصصية",
            isActive: true,
            doctorCount: 2,
          },
          {
            id: CLINIC_B_ID,
            name: "مركز الشفاء الطبي",
            isActive: false,
            doctorCount: 0,
          },
        ],
      );
    });

    it("throws 500 OwnerServiceError when clinics or doctors query fails", async () => {
      const clinicsErrClient = makeFakeAdminClient({
        clinicsSelectError: { message: "connection lost" },
      });
      await assert.rejects(
        () => listOwnerClinics(clinicsErrClient),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 500 &&
          err.code === "INTERNAL_ERROR",
      );

      const doctorsErrClient = makeFakeAdminClient({
        clinics: [makeClinicRow()],
        doctorsSelectError: { message: "doctors query failed" },
      });
      await assert.rejects(
        () => listOwnerClinics(doctorsErrClient),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 500 &&
          err.code === "INTERNAL_ERROR",
      );
    });
  });

  describe("createOwnerClinic", () => {
    it("creates a clinic and returns OwnerClinic with doctorCount 0", async () => {
      const client = makeFakeAdminClient({});

      const created = await createOwnerClinic(client, {
        name: "عيادة الرحمة",
        address: "شارع عرابي، دمنهور",
        phone: "0453399887",
        isActive: true,
      });

      assert.equal(created.name, "عيادة الرحمة");
      assert.equal(created.address, "شارع عرابي، دمنهور");
      assert.equal(created.phone, "0453399887");
      assert.equal(created.isActive, true);
      assert.equal(created.doctorCount, 0);
    });

    it("maps 23505 conflict to 409 OwnerServiceError", async () => {
      const client = makeFakeAdminClient({
        insertError: { code: "23505", message: "duplicate key value" },
      });

      await assert.rejects(
        () =>
          createOwnerClinic(client, {
            name: "عيادة النيل التخصصية",
            address: "شارع الجمهورية",
            phone: "0453311223",
            isActive: true,
          }),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 409 &&
          err.code === "CONFLICT" &&
          err.message === "العيادة دي موجودة بالفعل.",
      );
    });
  });

  describe("updateOwnerClinic", () => {
    it("updates partial clinic fields and hydrates doctorCount", async () => {
      const client = makeFakeAdminClient({
        clinics: [makeClinicRow()],
        doctors: [
          { id: "d1", clinic_id: CLINIC_A_ID },
          { id: "d2", clinic_id: CLINIC_A_ID },
          { id: "d3", clinic_id: CLINIC_A_ID },
        ],
      });

      const updated = await updateOwnerClinic(client, CLINIC_A_ID, {
        isActive: false,
      });

      assert.equal(updated.id, CLINIC_A_ID);
      assert.equal(updated.isActive, false);
      assert.equal(updated.doctorCount, 3);
      assert.equal(updated.updatedAt, "2026-02-01T00:00:00Z");
    });

    it("hydrates doctorCount when fallback data array is returned", async () => {
      const client = makeFakeAdminClient({
        clinics: [makeClinicRow()],
        doctors: [{ id: "d1", clinic_id: CLINIC_A_ID }],
        useArrayCountFallback: true,
      });

      const updated = await updateOwnerClinic(client, CLINIC_A_ID, {
        name: "عيادة النيل الجديدة",
      });
      assert.equal(updated.name, "عيادة النيل الجديدة");
      assert.equal(updated.doctorCount, 1);
    });

    it("throws 404 when clinic does not exist (maybeSingle null or PGRST116)", async () => {
      const missingClient = makeFakeAdminClient({ clinics: [] });

      await assert.rejects(
        () =>
          updateOwnerClinic(missingClient, MISSING_CLINIC_ID, {
            name: "عيادة جديدة",
          }),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 404 &&
          err.code === "NOT_FOUND" &&
          err.message === "العيادة دي مش موجودة.",
      );

      const pgrstClient = makeFakeAdminClient({
        updateError: { code: "PGRST116", message: "0 rows" },
      });

      await assert.rejects(
        () =>
          updateOwnerClinic(pgrstClient, MISSING_CLINIC_ID, {
            name: "عيادة جديدة",
          }),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 404 &&
          err.code === "NOT_FOUND" &&
          err.message === "العيادة دي مش موجودة.",
      );
    });

    it("maps 23505 to 409 and rejects empty updates with 400", async () => {
      const conflictClient = makeFakeAdminClient({
        clinics: [makeClinicRow()],
        updateError: { code: "23505", message: "duplicate" },
      });

      await assert.rejects(
        () =>
          updateOwnerClinic(conflictClient, CLINIC_A_ID, {
            name: "عيادة مكررة",
          }),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 409 &&
          err.code === "CONFLICT" &&
          err.message === "العيادة دي موجودة بالفعل.",
      );

      await assert.rejects(
        () => updateOwnerClinic(conflictClient, CLINIC_A_ID, {}),
        (err: unknown) =>
          err instanceof OwnerServiceError &&
          err.status === 400 &&
          err.code === "VALIDATION_ERROR",
      );
    });
  });
});
