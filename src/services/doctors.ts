import type { DoctorCardData, DoctorProfileData } from "@/types/catalog";
import type { SpecialtySummary } from "@/types/catalog";

import { getActiveClinic } from "./clinics";
import { getActiveSpecialty, type CatalogClient } from "./specialties";

export async function listDoctorsBySpecialty(
  client: CatalogClient,
  specialty: SpecialtySummary,
): Promise<DoctorCardData[]> {
  const { data: doctors, error: doctorsError } = await client
    .from("doctors")
    .select("*")
    .eq("specialty_id", specialty.id)
    .eq("is_active", true)
    .order("full_name");

  if (doctorsError) {
    throw new Error("مش قادرين نجيب الدكاترة دلوقتي، حاول تاني بعد شوية.");
  }

  const clinicIds = [...new Set((doctors ?? []).map((row) => row.clinic_id))];
  if (clinicIds.length === 0) {
    return [];
  }

  const { data: clinics, error: clinicsError } = await client
    .from("clinics")
    .select("id, name, address")
    .in("id", clinicIds)
    .eq("is_active", true);

  if (clinicsError) {
    throw new Error("مش قادرين نجيب بيانات العيادات دلوقتي، حاول تاني بعد شوية.");
  }

  const activeClinics = new Map(
    (clinics ?? []).map((row) => [row.id, row]),
  );

  return (doctors ?? [])
    .filter((row) => activeClinics.has(row.clinic_id))
    .map((row) => {
      const clinic = activeClinics.get(row.clinic_id)!;
      return {
        id: row.id,
        fullName: row.full_name,
        specialtyName: specialty.name,
        bio: row.bio,
        clinicName: clinic.name,
        clinicAddress: clinic.address,
        consultationFee: row.consultation_fee,
      };
    });
}

export async function getPublicDoctorById(
  client: CatalogClient,
  id: string,
): Promise<DoctorProfileData | null> {
  const { data: doctor, error: doctorError } = await client
    .from("doctors")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (doctorError) {
    throw new Error("مش قادرين نجيب بيانات الدكتور دلوقتي، حاول تاني بعد شوية.");
  }
  if (!doctor) {
    return null;
  }

  const [specialty, clinic] = await Promise.all([
    getActiveSpecialty(client, doctor.specialty_id),
    getActiveClinic(client, doctor.clinic_id),
  ]);
  if (!specialty || !clinic) {
    return null;
  }

  const { data: schedule, error: scheduleError } = await client
    .from("weekly_schedules")
    .select("day_of_week, start_time, end_time")
    .eq("doctor_id", id)
    .eq("is_active", true)
    .order("day_of_week")
    .order("start_time");

  if (scheduleError) {
    throw new Error("مش قادرين نجيب مواعيد الدكتور دلوقتي، حاول تاني بعد شوية.");
  }

  return {
    id: doctor.id,
    fullName: doctor.full_name,
    specialtyName: specialty.name,
    bio: doctor.bio,
    clinicName: clinic.name,
    clinicAddress: clinic.address,
    consultationFee: doctor.consultation_fee,
    photoUrl: doctor.photo_url,
    qualifications: doctor.qualifications,
    experienceYears: doctor.experience_years,
    workingSchedule: (schedule ?? []).map((row) => ({
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
    })),
  };
}
