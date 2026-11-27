import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OwnerServiceError } from "@/services/owner-errors";
import type { Clinic, Doctor, Specialty } from "@/types/database";

import {
  createOwnerDoctor,
  getOwnerDoctorById,
  listOwnerDoctorFormOptions,
  listOwnerDoctors,
  updateOwnerDoctor,
  uploadDoctorPhoto,
  type OwnerDoctorsClient,
} from "./owner-doctors";

const CLINIC_1_ID = "11000000-0000-0000-0000-000000000001";
const CLINIC_2_ID = "11000000-0000-0000-0000-000000000002";
const SPECIALTY_1_ID = "22000000-0000-0000-0000-000000000001";
const SPECIALTY_2_ID = "22000000-0000-0000-0000-000000000002";
const DOCTOR_1_ID = "33000000-0000-0000-0000-000000000001";
const DOCTOR_2_ID = "33000000-0000-0000-0000-000000000002";
const MISSING_ID = "99000000-0000-0000-0000-000000000099";

function makeClinic(id: string, name: string, isActive = true): Clinic {
  return {
    id,
    name,
    address: "دمنهور، البحيرة",
    phone: "01000000001",
    is_active: isActive,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function makeSpecialty(
  id: string,
  name: string,
  isActive = true,
): Specialty {
  return {
    id,
    name,
    description: null,
    is_active: isActive,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function makeDoctor(
  overrides: Partial<Doctor> & { id: string; full_name: string },
): Doctor {
  return {
    clinic_id: CLINIC_1_ID,
    specialty_id: SPECIALTY_1_ID,
    photo_url: null,
    bio: "خبرة في الكشف والمتابعة",
    qualifications: "استشاري",
    experience_years: 12,
    consultation_fee: "200.00",
    slot_duration_minutes: 30,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

interface FakeStorageState {
  uploads: Array<{
    bucket: string;
    path: string;
    bytes: Uint8Array;
    contentType?: string;
    upsert?: boolean;
  }>;
  uploadError?: { message: string } | null;
  publicUrl?: string;
}

function createFakeAdminClient(
  seed: {
    clinics?: Clinic[];
    specialties?: Specialty[];
    doctors?: Doctor[];
  },
  options: {
    insertError?: { code?: string; message?: string } | null;
    updateError?: { code?: string; message?: string } | null;
    storage?: Partial<FakeStorageState>;
  } = {},
) {
  const db: Record<string, Array<Record<string, unknown>>> = {
    clinics: (seed.clinics ?? []).map((row) => ({ ...row })),
    specialties: (seed.specialties ?? []).map((row) => ({ ...row })),
    doctors: (seed.doctors ?? []).map((row) => ({ ...row })),
  };

  const storageState: FakeStorageState = {
    uploads: [],
    uploadError: options.storage?.uploadError ?? null,
    publicUrl: options.storage?.publicUrl,
  };

  let createdCounter = 10;

  const client = {
    from(table: string) {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      let orderBy: string | null = null;
      let pendingInsert: Record<string, unknown> | null = null;
      let pendingUpdate: Record<string, unknown> | null = null;

      const applyFiltersAndSort = (rows: Array<Record<string, unknown>>) => {
        let filtered = rows.filter((row) => filters.every((fn) => fn(row)));
        if (orderBy) {
          const key = orderBy;
          filtered = [...filtered].sort((a, b) =>
            String(a[key] ?? "").localeCompare(String(b[key] ?? ""), "ar"),
          );
        }
        return filtered.map((row) => ({ ...row }));
      };

      const execute = () => {
        const tableRows = db[table] ?? [];

        if (pendingInsert) {
          if (options.insertError) {
            return { data: null, error: options.insertError };
          }
          createdCounter += 1;
          const inserted: Record<string, unknown> = {
            id: `33000000-0000-0000-0000-0000000000${createdCounter}`,
            created_at: "2026-01-02T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
            ...pendingInsert,
          };
          tableRows.push(inserted);
          return { data: { ...inserted }, error: null };
        }

        if (pendingUpdate) {
          if (options.updateError) {
            return { data: null, error: options.updateError };
          }
          const matching = tableRows.filter((row) =>
            filters.every((fn) => fn(row)),
          );
          if (matching.length === 0) {
            return { data: [], error: null };
          }
          for (const row of matching) {
            Object.assign(row, pendingUpdate, {
              updated_at: "2026-01-03T00:00:00Z",
            });
          }
          return {
            data: matching.map((row) => ({ ...row })),
            error: null,
          };
        }

        return { data: applyFiltersAndSort(tableRows), error: null };
      };

      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push((row) => row[column] === value);
          return builder;
        },
        in: (column: string, values: unknown[]) => {
          filters.push((row) => values.includes(row[column]));
          return builder;
        },
        order: (column: string) => {
          orderBy = column;
          return builder;
        },
        insert: (payload: Record<string, unknown>) => {
          pendingInsert = payload;
          return builder;
        },
        update: (payload: Record<string, unknown>) => {
          pendingUpdate = payload;
          return builder;
        },
        single: async () => {
          const result = execute();
          if (result.error) {
            return { data: null, error: result.error };
          }
          const row = Array.isArray(result.data)
            ? result.data[0]
            : result.data;
          if (!row) {
            return { data: null, error: { code: "PGRST116", message: "none" } };
          }
          return { data: row, error: null };
        },
        maybeSingle: async () => {
          const result = execute();
          if (result.error) {
            return { data: null, error: result.error };
          }
          const row = Array.isArray(result.data)
            ? (result.data[0] ?? null)
            : (result.data ?? null);
          return { data: row, error: null };
        },
        then: (
          resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve(execute()).then(resolve, reject),
      };

      return builder;
    },
    storage: {
      from(bucket: string) {
        return {
          async upload(
            path: string,
            bytes: Uint8Array,
            uploadOptions?: { contentType?: string; upsert?: boolean },
          ) {
            if (storageState.uploadError) {
              return { data: null, error: storageState.uploadError };
            }
            storageState.uploads.push({
              bucket,
              path,
              bytes,
              contentType: uploadOptions?.contentType,
              upsert: uploadOptions?.upsert,
            });
            return { data: { path }, error: null };
          },
          getPublicUrl(path: string) {
            return {
              data: {
                publicUrl:
                  storageState.publicUrl ??
                  `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}`,
              },
            };
          },
        };
      },
    },
  };

  return {
    client: client as unknown as OwnerDoctorsClient,
    storageState,
    db,
  };
}

describe("owner-doctors service", () => {
  it("lists doctors ordered by name with hydrated clinic and specialty metadata and respects filters", async () => {
    const { client } = createFakeAdminClient({
      clinics: [
        makeClinic(CLINIC_1_ID, "عيادة النيل", true),
        makeClinic(CLINIC_2_ID, "عيادة السلام", false),
      ],
      specialties: [
        makeSpecialty(SPECIALTY_1_ID, "باطنة", true),
        makeSpecialty(SPECIALTY_2_ID, "أطفال", false),
      ],
      doctors: [
        makeDoctor({
          id: DOCTOR_2_ID,
          full_name: "د. يحيى حسن",
          clinic_id: CLINIC_2_ID,
          specialty_id: SPECIALTY_2_ID,
          is_active: false,
        }),
        makeDoctor({
          id: DOCTOR_1_ID,
          full_name: "د. أحمد علي",
          clinic_id: CLINIC_1_ID,
          specialty_id: SPECIALTY_1_ID,
          is_active: true,
        }),
      ],
    });

    const allDoctors = await listOwnerDoctors(client);
    assert.equal(allDoctors.length, 2);
    assert.equal(allDoctors[0].fullName, "د. أحمد علي");
    assert.equal(allDoctors[0].clinicName, "عيادة النيل");
    assert.equal(allDoctors[0].clinicIsActive, true);
    assert.equal(allDoctors[1].fullName, "د. يحيى حسن");
    assert.equal(allDoctors[1].clinicName, "عيادة السلام");
    assert.equal(allDoctors[1].clinicIsActive, false);
    assert.equal(allDoctors[1].specialtyName, "أطفال");
    assert.equal(allDoctors[1].specialtyIsActive, false);

    const activeOnly = await listOwnerDoctors(client, {
      includeInactive: false,
    });
    assert.deepEqual(
      activeOnly.map((item) => item.id),
      [DOCTOR_1_ID],
    );

    const byClinic = await listOwnerDoctors(client, { clinicId: CLINIC_2_ID });
    assert.deepEqual(
      byClinic.map((item) => item.id),
      [DOCTOR_2_ID],
    );

    const bySpecialty = await listOwnerDoctors(client, {
      specialtyId: SPECIALTY_1_ID,
    });
    assert.deepEqual(
      bySpecialty.map((item) => item.id),
      [DOCTOR_1_ID],
    );
  });

  it("loads clinics and specialties options directly for forms and filters", async () => {
    const { client } = createFakeAdminClient({
      clinics: [
        makeClinic(CLINIC_2_ID, "عيادة النور", false),
        makeClinic(CLINIC_1_ID, "عيادة الأمل", true),
      ],
      specialties: [
        makeSpecialty(SPECIALTY_2_ID, "جلدية", false),
        makeSpecialty(SPECIALTY_1_ID, "باطنة", true),
      ],
    });

    const options = await listOwnerDoctorFormOptions(client);
    assert.deepEqual(options.clinics, [
      { id: CLINIC_1_ID, name: "عيادة الأمل", isActive: true },
      { id: CLINIC_2_ID, name: "عيادة النور", isActive: false },
    ]);
    assert.deepEqual(options.specialties, [
      { id: SPECIALTY_1_ID, name: "باطنة", isActive: true },
      { id: SPECIALTY_2_ID, name: "جلدية", isActive: false },
    ]);
  });

  it("gets a doctor by id and throws 404 when missing", async () => {
    const { client } = createFakeAdminClient({
      clinics: [makeClinic(CLINIC_1_ID, "عيادة النيل")],
      specialties: [makeSpecialty(SPECIALTY_1_ID, "باطنة")],
      doctors: [makeDoctor({ id: DOCTOR_1_ID, full_name: "د. أحمد علي" })],
    });

    const found = await getOwnerDoctorById(client, DOCTOR_1_ID);
    assert.equal(found.id, DOCTOR_1_ID);
    assert.equal(found.clinicName, "عيادة النيل");

    await assert.rejects(
      () => getOwnerDoctorById(client, MISSING_ID),
      (error: unknown) =>
        error instanceof OwnerServiceError &&
        error.status === 404 &&
        error.code === "NOT_FOUND",
    );
  });

  it("creates a doctor when clinic and specialty exist and rejects missing references", async () => {
    const { client } = createFakeAdminClient({
      clinics: [makeClinic(CLINIC_1_ID, "عيادة النيل")],
      specialties: [makeSpecialty(SPECIALTY_1_ID, "باطنة")],
      doctors: [],
    });

    const created = await createOwnerDoctor(client, {
      fullName: "د. سارة محمود",
      clinicId: CLINIC_1_ID,
      specialtyId: SPECIALTY_1_ID,
      bio: "متخصصة في طب الأطفال",
      qualifications: "ماجستير",
      experienceYears: 8,
      consultationFee: "250.00",
      slotDurationMinutes: 20,
      photoUrl: "/doctors/sara.jpg",
      isActive: true,
    });

    assert.equal(created.fullName, "د. سارة محمود");
    assert.equal(created.clinicName, "عيادة النيل");
    assert.equal(created.specialtyName, "باطنة");
    assert.equal(created.consultationFee, "250.00");

    await assert.rejects(
      () =>
        createOwnerDoctor(client, {
          fullName: "د. سارة محمود",
          clinicId: MISSING_ID,
          specialtyId: SPECIALTY_1_ID,
          bio: null,
          qualifications: null,
          experienceYears: null,
          consultationFee: "200.00",
          slotDurationMinutes: 30,
          photoUrl: null,
          isActive: true,
        }),
      (error: unknown) =>
        error instanceof OwnerServiceError &&
        error.status === 400 &&
        error.code === "VALIDATION_ERROR" &&
        Boolean(error.fieldErrors?.clinicId),
    );

    await assert.rejects(
      () =>
        createOwnerDoctor(client, {
          fullName: "د. سارة محمود",
          clinicId: CLINIC_1_ID,
          specialtyId: MISSING_ID,
          bio: null,
          qualifications: null,
          experienceYears: null,
          consultationFee: "200.00",
          slotDurationMinutes: 30,
          photoUrl: null,
          isActive: true,
        }),
      (error: unknown) =>
        error instanceof OwnerServiceError &&
        error.status === 400 &&
        error.code === "VALIDATION_ERROR" &&
        Boolean(error.fieldErrors?.specialtyId),
    );
  });

  it("maps DB constraint errors during createOwnerDoctor", async () => {
    const { client } = createFakeAdminClient(
      {
        clinics: [makeClinic(CLINIC_1_ID, "عيادة النيل")],
        specialties: [makeSpecialty(SPECIALTY_1_ID, "باطنة")],
      },
      { insertError: { code: "23514", message: "raw constraint" } },
    );

    await assert.rejects(
      () =>
        createOwnerDoctor(client, {
          fullName: "د. خالد سعيد",
          clinicId: CLINIC_1_ID,
          specialtyId: SPECIALTY_1_ID,
          bio: null,
          qualifications: null,
          experienceYears: null,
          consultationFee: "200.00",
          slotDurationMinutes: 30,
          photoUrl: null,
          isActive: true,
        }),
      (error: unknown) =>
        error instanceof OwnerServiceError &&
        error.status === 400 &&
        !error.message.includes("raw constraint"),
    );
  });

  it("updates a doctor, validates changed references, and throws 404 when missing", async () => {
    const { client } = createFakeAdminClient({
      clinics: [
        makeClinic(CLINIC_1_ID, "عيادة النيل"),
        makeClinic(CLINIC_2_ID, "عيادة السلام"),
      ],
      specialties: [makeSpecialty(SPECIALTY_1_ID, "باطنة")],
      doctors: [makeDoctor({ id: DOCTOR_1_ID, full_name: "د. أحمد علي" })],
    });

    const updated = await updateOwnerDoctor(client, DOCTOR_1_ID, {
      clinicId: CLINIC_2_ID,
      consultationFee: "300.00",
      isActive: false,
    });

    assert.equal(updated.clinicId, CLINIC_2_ID);
    assert.equal(updated.clinicName, "عيادة السلام");
    assert.equal(updated.consultationFee, "300.00");
    assert.equal(updated.isActive, false);

    await assert.rejects(
      () => updateOwnerDoctor(client, MISSING_ID, { isActive: false }),
      (error: unknown) =>
        error instanceof OwnerServiceError && error.status === 404,
    );

    await assert.rejects(
      () => updateOwnerDoctor(client, DOCTOR_1_ID, { specialtyId: MISSING_ID }),
      (error: unknown) =>
        error instanceof OwnerServiceError &&
        error.status === 400 &&
        Boolean(error.fieldErrors?.specialtyId),
    );

    await assert.rejects(
      () => updateOwnerDoctor(client, DOCTOR_1_ID, {}),
      (error: unknown) =>
        error instanceof OwnerServiceError &&
        error.status === 400 &&
        error.code === "VALIDATION_ERROR",
    );
  });

  describe("uploadDoctorPhoto", () => {
    it("uploads valid PNG, JPEG, and WebP files with private upsert=false paths", async () => {
      const { client, storageState } = createFakeAdminClient({});

      const pngBytes = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
      ]);
      const pngFile = new File([pngBytes], "avatar.png", { type: "image/png" });
      const pngResult = await uploadDoctorPhoto(client, pngFile);
      assert.match(pngResult.photoUrl, /\/doctor-photos\/doctors\/.+\.png$/);

      const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const jpgFile = new File([jpgBytes], "avatar.jpg", { type: "image/jpeg" });
      const jpgResult = await uploadDoctorPhoto(client, jpgFile);
      assert.match(jpgResult.photoUrl, /\/doctor-photos\/doctors\/.+\.jpg$/);

      const webpBytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]);
      const webpFile = new File([webpBytes], "avatar.webp", {
        type: "image/webp",
      });
      const webpResult = await uploadDoctorPhoto(client, webpFile);
      assert.match(webpResult.photoUrl, /\/doctor-photos\/doctors\/.+\.webp$/);

      assert.equal(storageState.uploads.length, 3);
      assert.equal(storageState.uploads[0].bucket, "doctor-photos");
      assert.equal(storageState.uploads[0].upsert, false);
      assert.equal(storageState.uploads[0].contentType, "image/png");
      assert.equal(storageState.uploads[1].contentType, "image/jpeg");
      assert.equal(storageState.uploads[2].contentType, "image/webp");
    });

    it("rejects spoofed magic bytes, unsupported MIME types, empty files, and >5MB files", async () => {
      const { client, storageState } = createFakeAdminClient({});

      const spoofedFile = new File(
        [new TextEncoder().encode("<html>not an image</html>")],
        "fake.png",
        { type: "image/png" },
      );
      await assert.rejects(
        () => uploadDoctorPhoto(client, spoofedFile),
        (error: unknown) =>
          error instanceof OwnerServiceError &&
          error.status === 400 &&
          Boolean(error.fieldErrors?.file),
      );

      const svgFile = new File(
        [new TextEncoder().encode("<svg></svg>")],
        "vector.svg",
        { type: "image/svg+xml" },
      );
      await assert.rejects(
        () => uploadDoctorPhoto(client, svgFile),
        (error: unknown) =>
          error instanceof OwnerServiceError &&
          error.status === 400 &&
          Boolean(error.fieldErrors?.file),
      );

      const emptyFile = new File([], "empty.png", { type: "image/png" });
      await assert.rejects(
        () => uploadDoctorPhoto(client, emptyFile),
        (error: unknown) =>
          error instanceof OwnerServiceError && error.status === 400,
      );

      const oversizedBytes = new Uint8Array(5 * 1024 * 1024 + 1);
      oversizedBytes[0] = 0x89;
      oversizedBytes[1] = 0x50;
      oversizedBytes[2] = 0x4e;
      oversizedBytes[3] = 0x47;
      oversizedBytes[4] = 0x0d;
      oversizedBytes[5] = 0x0a;
      oversizedBytes[6] = 0x1a;
      oversizedBytes[7] = 0x0a;
      const oversizedFile = new File([oversizedBytes], "huge.png", {
        type: "image/png",
      });
      await assert.rejects(
        () => uploadDoctorPhoto(client, oversizedFile),
        (error: unknown) =>
          error instanceof OwnerServiceError && error.status === 400,
      );

      assert.equal(storageState.uploads.length, 0);
    });

    it("throws localized 500 without leaking raw storage errors when upload fails", async () => {
      const { client } = createFakeAdminClient(
        {},
        { storage: { uploadError: { message: "secret bucket internal trace" } } },
      );

      const pngBytes = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      const pngFile = new File([pngBytes], "avatar.png", { type: "image/png" });

      await assert.rejects(
        () => uploadDoctorPhoto(client, pngFile),
        (error: unknown) =>
          error instanceof OwnerServiceError &&
          error.status === 500 &&
          error.code === "INTERNAL_ERROR" &&
          !error.message.includes("secret bucket"),
      );
    });

    it("rejects unsupported MIME types and >5MB files before calling arrayBuffer()", async () => {
      const { client } = createFakeAdminClient({});

      const unsupportedMimeFile = {
        type: "image/svg+xml",
        size: 120,
        arrayBuffer() {
          throw new Error("arrayBuffer should not be called for invalid MIME");
        },
      } as unknown as File;

      await assert.rejects(
        () => uploadDoctorPhoto(client, unsupportedMimeFile),
        (error: unknown) =>
          error instanceof OwnerServiceError &&
          error.status === 400 &&
          error.code === "VALIDATION_ERROR" &&
          Boolean(error.fieldErrors?.file),
      );

      const oversizedFile = {
        type: "image/png",
        size: 5 * 1024 * 1024 + 1,
        arrayBuffer() {
          throw new Error("arrayBuffer should not be called for >5MB files");
        },
      } as unknown as File;

      await assert.rejects(
        () => uploadDoctorPhoto(client, oversizedFile),
        (error: unknown) =>
          error instanceof OwnerServiceError &&
          error.status === 400 &&
          error.code === "VALIDATION_ERROR" &&
          Boolean(error.fieldErrors?.file),
      );
    });
  });
});
