import type { Clinic, Specialty, WeeklySchedule } from "@/types/database";

export type SpecialtySummary = Pick<Specialty, "id" | "name" | "description">;

export type ClinicSummary = Pick<Clinic, "id" | "name" | "address">;

export type DoctorCardData = {
  id: string;
  fullName: string;
  specialtyName: string;
  bio: string | null;
  clinicName: string;
  clinicAddress: string;
  consultationFee: string;
};

export type DoctorProfileData = DoctorCardData & {
  photoUrl: string | null;
  qualifications: string | null;
  experienceYears: number | null;
  workingSchedule: Array<
    Pick<WeeklySchedule, "day_of_week" | "start_time" | "end_time">
  >;
};
