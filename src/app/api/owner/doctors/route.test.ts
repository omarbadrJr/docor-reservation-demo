import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GET as doctorByIdGet,
  PATCH as doctorByIdPatch,
} from "@/app/api/owner/doctors/[id]/route";
import { POST as doctorPhotoPost } from "@/app/api/owner/doctors/photo/route";
import { GET as doctorsGet, POST as doctorsPost } from "@/app/api/owner/doctors/route";
import { assertRole } from "@/services/auth";
import {
  createOwnerDoctorByIdGetHandler,
  createOwnerDoctorByIdPatchHandler,
  createOwnerDoctorPhotoPostHandler,
  createOwnerDoctorsGetHandler,
  createOwnerDoctorsPostHandler,
  type OwnerDoctorsClient,
} from "@/services/owner-doctors";
import type { StaffProfile } from "@/types/auth";
import type { AdminRole, Clinic, Doctor, Specialty } from "@/types/database";
import type { OwnerDoctor, OwnerErrorResponse } from "@/types/owner";

const OWNER_ID = "aa000000-0000-0000-0000-000000000001";
const RECEPTIONIST_ID = "aa000000-0000-0000-0000-000000000002";
const CLINIC_ID = "11000000-0000-0000-0000-000000000001";
const SPECIALTY_ID = "22000000-0000-0000-0000-000000000001";
const DOCTOR_ID = "33000000-0000-0000-0000-000000000001";
const MISSING_ID = "99000000-0000-0000-0000-000000000099";

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
  clinicName: "عيادة النيل",
  isActive: true,
};

const VALID_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);

function makeRequireAdmin(session: StaffProfile | null) {
  return async (allowedRoles?: readonly AdminRole[]): Promise<StaffProfile> =>
    assertRole(session, allowedRoles);
}

function makeRouteAdminClient(options: {
  storageError?: boolean;
} = {}) {
  const clinics: Clinic[] = [
    {
      id: CLINIC_ID,
      name: "عيادة النيل",
      address: "دمنهور، البحيرة",
      phone: "01010000001",
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
      id: DOCTOR_ID,
      clinic_id: CLINIC_ID,
      specialty_id: SPECIALTY_ID,
      full_name: "د. أحمد مصطفى",
      photo_url: null,
      bio: "خبرة في أمراض الباطنة",
      qualifications: "استشاري",
      experience_years: 10,
      consultation_fee: "200.00",
      slot_duration_minutes: 30,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];

  const tables: Record<string, Array<Record<string, unknown>>> = {
    clinics: clinics.map((row) => ({ ...row })),
    specialties: specialties.map((row) => ({ ...row })),
    doctors: doctors.map((row) => ({ ...row })),
  };

  let createdCounter = 20;

  const client = {
    from(table: string) {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      let orderBy: string | null = null;
      let pendingInsert: Record<string, unknown> | null = null;
      let pendingUpdate: Record<string, unknown> | null = null;

      const execute = () => {
        const tableRows = tables[table] ?? [];

        if (pendingInsert) {
          createdCounter += 1;
          const inserted = {
            id: `33000000-0000-0000-0000-0000000000${createdCounter}`,
            created_at: "2026-01-02T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
            ...pendingInsert,
          };
          tableRows.push(inserted);
          return { data: { ...inserted }, error: null };
        }

        if (pendingUpdate) {
          const matching = tableRows.filter((row) =>
            filters.every((fn) => fn(row)),
          );
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

        let rows = tableRows.filter((row) => filters.every((fn) => fn(row)));
        if (orderBy) {
          const key = orderBy;
          rows = [...rows].sort((a, b) =>
            String(a[key] ?? "").localeCompare(String(b[key] ?? ""), "ar"),
          );
        }
        return { data: rows.map((row) => ({ ...row })), error: null };
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
          const row = Array.isArray(result.data)
            ? result.data[0]
            : result.data;
          return { data: row ?? null, error: result.error };
        },
        maybeSingle: async () => {
          const result = execute();
          const row = Array.isArray(result.data)
            ? (result.data[0] ?? null)
            : (result.data ?? null);
          return { data: row, error: result.error };
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
          async upload(path: string) {
            if (options.storageError) {
              return { data: null, error: { message: "storage unavailable" } };
            }
            return { data: { path }, error: null };
          },
          getPublicUrl(path: string) {
            return {
              data: {
                publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}`,
              },
            };
          },
        };
      },
    },
  };

  return client as unknown as OwnerDoctorsClient;
}

describe("Owner doctors API routes", () => {
  it("exports Next.js HTTP method handlers on all doctor routes", () => {
    assert.equal(typeof doctorsGet, "function");
    assert.equal(typeof doctorsPost, "function");
    assert.equal(typeof doctorByIdGet, "function");
    assert.equal(typeof doctorByIdPatch, "function");
    assert.equal(typeof doctorPhotoPost, "function");
  });

  describe("RBAC and Cache-Control", () => {
    it("returns 401 and 403 with Cache-Control: no-store across all endpoints", async () => {
      const unauthGet = createOwnerDoctorsGetHandler({
        requireAdmin: makeRequireAdmin(null),
      });
      const unauthRes = await unauthGet(
        new Request("http://localhost/api/owner/doctors"),
      );
      assert.equal(unauthRes.status, 401);
      assert.equal(unauthRes.headers.get("cache-control"), "no-store");

      const receptionistPost = createOwnerDoctorsPostHandler({
        requireAdmin: makeRequireAdmin(RECEPTIONIST_PROFILE),
      });
      const forbiddenPost = await receptionistPost(
        new Request("http://localhost/api/owner/doctors", {
          method: "POST",
          body: JSON.stringify({}),
        }),
      );
      assert.equal(forbiddenPost.status, 403);
      assert.equal(forbiddenPost.headers.get("cache-control"), "no-store");

      const receptionistByIdGet = createOwnerDoctorByIdGetHandler({
        requireAdmin: makeRequireAdmin(RECEPTIONIST_PROFILE),
      });
      const forbiddenByIdGet = await receptionistByIdGet(
        new Request(`http://localhost/api/owner/doctors/${DOCTOR_ID}`),
        DOCTOR_ID,
      );
      assert.equal(forbiddenByIdGet.status, 403);
      assert.equal(forbiddenByIdGet.headers.get("cache-control"), "no-store");

      const inactivePatch = createOwnerDoctorByIdPatchHandler({
        requireAdmin: makeRequireAdmin({ ...OWNER_PROFILE, isActive: false }),
      });
      const inactivePatchRes = await inactivePatch(
        new Request(`http://localhost/api/owner/doctors/${DOCTOR_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: false }),
        }),
        DOCTOR_ID,
      );
      assert.equal(inactivePatchRes.status, 403);
      assert.equal(inactivePatchRes.headers.get("cache-control"), "no-store");
      assert.equal(
        ((await inactivePatchRes.json()) as OwnerErrorResponse).code,
        "ACCOUNT_INACTIVE",
      );

      const receptionistPhoto = createOwnerDoctorPhotoPostHandler({
        requireAdmin: makeRequireAdmin(RECEPTIONIST_PROFILE),
      });
      const forbiddenPhoto = await receptionistPhoto(
        new Request("http://localhost/api/owner/doctors/photo", {
          method: "POST",
        }),
      );
      assert.equal(forbiddenPhoto.status, 403);
      assert.equal(forbiddenPhoto.headers.get("cache-control"), "no-store");
    });
  });

  describe("GET & POST /api/owner/doctors", () => {
    it("lists doctors and validates filter params", async () => {
      const client = makeRouteAdminClient();
      const handler = createOwnerDoctorsGetHandler({
        requireAdmin: makeRequireAdmin(OWNER_PROFILE),
        getAdminClient: () => client,
      });

      const okRes = await handler(
        new Request(
          `http://localhost/api/owner/doctors?clinicId=${CLINIC_ID}&includeInactive=true`,
        ),
      );
      assert.equal(okRes.status, 200);
      assert.equal(okRes.headers.get("cache-control"), "no-store");
      const okBody = (await okRes.json()) as { doctors: OwnerDoctor[] };
      assert.equal(okBody.doctors.length, 1);
      assert.equal(okBody.doctors[0].clinicName, "عيادة النيل");

      const badRes = await handler(
        new Request(
          "http://localhost/api/owner/doctors?clinicId=not-a-uuid&includeInactive=maybe",
        ),
      );
      assert.equal(badRes.status, 400);
      assert.equal(badRes.headers.get("cache-control"), "no-store");
      const badBody = (await badRes.json()) as OwnerErrorResponse;
      assert.equal(badBody.code, "VALIDATION_ERROR");
      assert.ok(badBody.fieldErrors?.clinicId);
      assert.ok(badBody.fieldErrors?.includeInactive);
    });

    it("creates a doctor and rejects invalid JSON or missing references", async () => {
      const client = makeRouteAdminClient();
      const handler = createOwnerDoctorsPostHandler({
        requireAdmin: makeRequireAdmin(OWNER_PROFILE),
        getAdminClient: () => client,
      });

      const invalidJsonRes = await handler(
        new Request("http://localhost/api/owner/doctors", {
          method: "POST",
          body: "{bad json",
        }),
      );
      assert.equal(invalidJsonRes.status, 400);
      assert.equal(invalidJsonRes.headers.get("cache-control"), "no-store");

      const missingRefRes = await handler(
        new Request("http://localhost/api/owner/doctors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: "د. هبة فتحي",
            clinicId: MISSING_ID,
            specialtyId: SPECIALTY_ID,
            consultationFee: 250,
            slotDurationMinutes: 30,
          }),
        }),
      );
      assert.equal(missingRefRes.status, 400);
      const missingRefBody = (await missingRefRes.json()) as OwnerErrorResponse;
      assert.ok(missingRefBody.fieldErrors?.clinicId);

      const createdRes = await handler(
        new Request("http://localhost/api/owner/doctors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: "د. هبة فتحي",
            clinicId: CLINIC_ID,
            specialtyId: SPECIALTY_ID,
            consultationFee: 250,
            slotDurationMinutes: 20,
            experienceYears: 7,
            bio: "متابعة الحالات المزمنة",
            qualifications: "ماجستير باطنة",
            photoUrl: "/doctors/heba.png",
            isActive: true,
          }),
        }),
      );
      assert.equal(createdRes.status, 201);
      assert.equal(createdRes.headers.get("cache-control"), "no-store");
      const createdBody = (await createdRes.json()) as { doctor: OwnerDoctor };
      assert.equal(createdBody.doctor.fullName, "د. هبة فتحي");
      assert.equal(createdBody.doctor.consultationFee, "250.00");
      assert.equal(createdBody.doctor.clinicName, "عيادة النيل");
    });
  });

  describe("GET & PATCH /api/owner/doctors/[id]", () => {
    it("reads by id and handles invalid UUID / 404", async () => {
      const client = makeRouteAdminClient();
      const handler = createOwnerDoctorByIdGetHandler({
        requireAdmin: makeRequireAdmin(OWNER_PROFILE),
        getAdminClient: () => client,
      });

      const badIdRes = await handler(
        new Request("http://localhost/api/owner/doctors/bad-id"),
        "bad-id",
      );
      assert.equal(badIdRes.status, 400);
      assert.equal(badIdRes.headers.get("cache-control"), "no-store");

      const notFoundRes = await handler(
        new Request(`http://localhost/api/owner/doctors/${MISSING_ID}`),
        MISSING_ID,
      );
      assert.equal(notFoundRes.status, 404);
      assert.equal(notFoundRes.headers.get("cache-control"), "no-store");

      const okRes = await handler(
        new Request(`http://localhost/api/owner/doctors/${DOCTOR_ID}`),
        DOCTOR_ID,
      );
      assert.equal(okRes.status, 200);
      assert.equal(okRes.headers.get("cache-control"), "no-store");
      const okBody = (await okRes.json()) as { doctor: OwnerDoctor };
      assert.equal(okBody.doctor.id, DOCTOR_ID);
    });

    it("updates doctor fields and validates payload", async () => {
      const client = makeRouteAdminClient();
      const handler = createOwnerDoctorByIdPatchHandler({
        requireAdmin: makeRequireAdmin(OWNER_PROFILE),
        getAdminClient: () => client,
      });

      const emptyPatchRes = await handler(
        new Request(`http://localhost/api/owner/doctors/${DOCTOR_ID}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
        DOCTOR_ID,
      );
      assert.equal(emptyPatchRes.status, 400);
      assert.equal(emptyPatchRes.headers.get("cache-control"), "no-store");

      const okRes = await handler(
        new Request(`http://localhost/api/owner/doctors/${DOCTOR_ID}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consultationFee: "350",
            isActive: false,
          }),
        }),
        DOCTOR_ID,
      );
      assert.equal(okRes.status, 200);
      assert.equal(okRes.headers.get("cache-control"), "no-store");
      const okBody = (await okRes.json()) as { doctor: OwnerDoctor };
      assert.equal(okBody.doctor.consultationFee, "350.00");
      assert.equal(okBody.doctor.isActive, false);
    });
  });

  describe("POST /api/owner/doctors/photo", () => {
    it("uploads valid image FormData and returns 201 with photoUrl", async () => {
      const client = makeRouteAdminClient();
      const handler = createOwnerDoctorPhotoPostHandler({
        requireAdmin: makeRequireAdmin(OWNER_PROFILE),
        getAdminClient: () => client,
      });

      const formData = new FormData();
      formData.append(
        "file",
        new File([VALID_PNG_BYTES], "doctor.png", { type: "image/png" }),
      );

      const response = await handler(
        new Request("http://localhost/api/owner/doctors/photo", {
          method: "POST",
          body: formData,
        }),
      );

      assert.equal(response.status, 201);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = (await response.json()) as { photoUrl: string };
      assert.match(body.photoUrl, /\/doctor-photos\/doctors\/.+\.png$/);
    });

    it("rejects missing file and spoofed image bytes with 400", async () => {
      const client = makeRouteAdminClient();
      const handler = createOwnerDoctorPhotoPostHandler({
        requireAdmin: makeRequireAdmin(OWNER_PROFILE),
        getAdminClient: () => client,
      });

      const emptyForm = new FormData();
      const missingRes = await handler(
        new Request("http://localhost/api/owner/doctors/photo", {
          method: "POST",
          body: emptyForm,
        }),
      );
      assert.equal(missingRes.status, 400);
      assert.equal(missingRes.headers.get("cache-control"), "no-store");

      const spoofForm = new FormData();
      spoofForm.append(
        "file",
        new File([new TextEncoder().encode("not png")], "fake.png", {
          type: "image/png",
        }),
      );
      const spoofRes = await handler(
        new Request("http://localhost/api/owner/doctors/photo", {
          method: "POST",
          body: spoofForm,
        }),
      );
      assert.equal(spoofRes.status, 400);
      assert.equal(spoofRes.headers.get("cache-control"), "no-store");
      const spoofBody = (await spoofRes.json()) as OwnerErrorResponse;
      assert.ok(spoofBody.fieldErrors?.file);
    });

    it("returns 500 with Cache-Control: no-store when storage fails", async () => {
      const client = makeRouteAdminClient({ storageError: true });
      const handler = createOwnerDoctorPhotoPostHandler({
        requireAdmin: makeRequireAdmin(OWNER_PROFILE),
        getAdminClient: () => client,
      });

      const formData = new FormData();
      formData.append(
        "file",
        new File([VALID_PNG_BYTES], "doctor.png", { type: "image/png" }),
      );

      const response = await handler(
        new Request("http://localhost/api/owner/doctors/photo", {
          method: "POST",
          body: formData,
        }),
      );

      assert.equal(response.status, 500);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = (await response.json()) as OwnerErrorResponse;
      assert.equal(body.code, "INTERNAL_ERROR");
      assert.ok(!body.error.includes("storage unavailable"));
    });
  });
});
