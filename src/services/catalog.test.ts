import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Clinic, Doctor, Specialty, WeeklySchedule } from "@/types/database";

import { getPublicDoctorById, listDoctorsBySpecialty } from "./doctors";

const SPECIALTY_ID = "22000000-0000-0000-0000-000000000001";
const OTHER_SPECIALTY_ID = "22000000-0000-0000-0000-000000000002";
const ACTIVE_CLINIC_ID = "11000000-0000-0000-0000-000000000001";
const INACTIVE_CLINIC_ID = "11000000-0000-0000-0000-000000000002";
const ACTIVE_DOCTOR_ID = "33000000-0000-0000-0000-000000000001";

const clinic = (
  id: string,
  isActive: boolean,
  name: string,
  address: string,
): Clinic => ({
  id,
  name,
  address,
  phone: "01010000001",
  is_active: isActive,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

const specialty = (id: string, name: string): Specialty => ({
  id,
  name,
  description: "وصف تجريبي",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

const doctor = (
  id: string,
  clinicId: string,
  specialtyId: string,
  isActive: boolean,
  fullName: string,
  photoUrl: string | null = "/doctors/demo-portrait.svg",
): Doctor => ({
  id,
  clinic_id: clinicId,
  specialty_id: specialtyId,
  full_name: fullName,
  photo_url: photoUrl,
  bio: "خبرة في متابعة الحالات",
  qualifications: "بكالوريوس طب",
  experience_years: 10,
  consultation_fee: "150.00",
  slot_duration_minutes: 30,
  is_active: isActive,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

const schedule: WeeklySchedule = {
  id: "44000000-0000-0000-0000-000000000001",
  doctor_id: ACTIVE_DOCTOR_ID,
  day_of_week: 0,
  start_time: "09:00:00",
  end_time: "17:00:00",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

type Dataset = Record<string, Record<string, unknown>[]>;

function fakeClient(dataset: Dataset) {
  const client = {
    from(table: string) {
      const filters: Record<string, unknown> = {};

      const result = () => {
        let rows = dataset[table] ?? [];
        for (const [key, value] of Object.entries(filters)) {
          rows = rows.filter((row) =>
            Array.isArray(value)
              ? value.includes(row[key])
              : row[key] === value,
          );
        }
        return { data: rows, error: null };
      };

      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (key: string, value: unknown) => {
          filters[key] = value;
          return builder;
        },
        in: (key: string, values: unknown[]) => {
          filters[key] = values;
          return builder;
        },
        order: () => builder,
        maybeSingle: async () => {
          const { data } = result();
          return { data: data[0] ?? null, error: null };
        },
        then: (
          resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve(result()).then(resolve, reject),
      };

      return builder;
    },
  };

  return client as unknown as Parameters<typeof listDoctorsBySpecialty>[0];
}

describe("listDoctorsBySpecialty", () => {
  it("returns only doctors at active clinics", async () => {
    const client = fakeClient({
      specialties: [specialty(SPECIALTY_ID, "باطنة")],
      clinics: [
        clinic(ACTIVE_CLINIC_ID, true, "عيادة النيل", "شارع النيل، البحيرة"),
        clinic(INACTIVE_CLINIC_ID, false, "عيادة مقفولة", "عنوان تجريبي"),
      ],
      doctors: [
        doctor(
          ACTIVE_DOCTOR_ID,
          ACTIVE_CLINIC_ID,
          SPECIALTY_ID,
          true,
          "د. أحمد مصطفى",
        ),
        doctor(
          "33000000-0000-0000-0000-000000000002",
          INACTIVE_CLINIC_ID,
          SPECIALTY_ID,
          true,
          "د. عيادة مقفولة",
        ),
        doctor(
          "33000000-0000-0000-0000-000000000003",
          ACTIVE_CLINIC_ID,
          SPECIALTY_ID,
          false,
          "د. غير نشط",
        ),
        doctor(
          "33000000-0000-0000-0000-000000000004",
          ACTIVE_CLINIC_ID,
          OTHER_SPECIALTY_ID,
          true,
          "د. تخصص تاني",
        ),
      ],
    });

    const result = await listDoctorsBySpecialty(client, {
      id: SPECIALTY_ID,
      name: "باطنة",
      description: null,
    });

    assert.deepEqual(result, [
      {
        id: ACTIVE_DOCTOR_ID,
        fullName: "د. أحمد مصطفى",
        specialtyName: "باطنة",
        bio: "خبرة في متابعة الحالات",
        clinicName: "عيادة النيل",
        clinicAddress: "شارع النيل، البحيرة",
        consultationFee: "150.00",
        photoUrl: "/doctors/demo-portrait.svg",
      },
    ]);
  });
});

describe("getPublicDoctorById", () => {
  it("returns null for an active doctor at an inactive clinic", async () => {
    const client = fakeClient({
      specialties: [specialty(SPECIALTY_ID, "باطنة")],
      clinics: [
        clinic(INACTIVE_CLINIC_ID, false, "عيادة مقفولة", "عنوان تجريبي"),
      ],
      doctors: [
        doctor(
          ACTIVE_DOCTOR_ID,
          INACTIVE_CLINIC_ID,
          SPECIALTY_ID,
          true,
          "د. أحمد مصطفى",
        ),
      ],
      weekly_schedules: [schedule],
    });

    assert.equal(await getPublicDoctorById(client, ACTIVE_DOCTOR_ID), null);
  });

  it("returns null for a missing doctor", async () => {
    const client = fakeClient({
      specialties: [],
      clinics: [],
      doctors: [],
      weekly_schedules: [],
    });

    assert.equal(await getPublicDoctorById(client, ACTIVE_DOCTOR_ID), null);
  });
});
