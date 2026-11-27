import type { AppointmentStatus, ScheduleExceptionType } from "./database";

export type OwnerErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "ACCOUNT_INACTIVE"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export interface OwnerErrorResponse {
  error: string;
  code: OwnerErrorCode;
  fieldErrors?: Record<string, string>;
}

export interface OwnerClinic {
  id: string;
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
  doctorCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerSpecialty {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  doctorCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerDoctor {
  id: string;
  fullName: string;
  clinicId: string;
  clinicName: string;
  clinicIsActive: boolean;
  specialtyId: string;
  specialtyName: string;
  specialtyIsActive: boolean;
  photoUrl: string | null;
  bio: string | null;
  qualifications: string | null;
  experienceYears: number | null;
  consultationFee: string;
  slotDurationMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerWeeklySchedule {
  id: string;
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: string;
}

export interface OwnerManualAvailability {
  id: string;
  doctorId: string;
  availabilityDate: string;
  startTime: string;
  endTime: string;
  createdAt: string;
}

export interface OwnerScheduleException {
  id: string;
  doctorId: string;
  exceptionDate: string;
  exceptionType: ScheduleExceptionType;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  createdAt: string;
}

export interface OwnerDoctorSchedules {
  doctor: {
    id: string;
    fullName: string;
    clinicName: string;
    specialtyName: string;
    slotDurationMinutes: number;
    isActive: boolean;
  };
  weeklySchedules: OwnerWeeklySchedule[];
  manualAvailabilities: OwnerManualAvailability[];
  scheduleExceptions: OwnerScheduleException[];
}

export interface OwnerReceptionist {
  id: string;
  name: string;
  email: string;
  clinicId: string;
  clinicName: string;
  clinicIsActive: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerAppointment {
  id: string;
  referenceNumber: string;
  doctorId: string;
  doctorName: string;
  doctorIsActive: boolean;
  clinicId: string;
  clinicName: string;
  clinicIsActive: boolean;
  specialtyName: string;
  patientName: string;
  patientPhone: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  createdAt: string;
}

export interface OwnerAppointmentsFilter {
  clinicId?: string;
  doctorId?: string;
  status?: AppointmentStatus;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  query?: string;
}

export interface OwnerDashboardOverview {
  todayDate: string;
  counts: {
    clinicsTotal: number;
    clinicsActive: number;
    specialtiesTotal: number;
    specialtiesActive: number;
    doctorsTotal: number;
    doctorsActive: number;
    receptionistsTotal: number;
    receptionistsActive: number;
    todayAppointments: number;
    upcomingAppointments: number;
  };
  todayAppointments: OwnerAppointment[];
  upcomingAppointments: OwnerAppointment[];
}

export interface CreateClinicInput {
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
}

export interface UpdateClinicInput {
  name?: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
}

export interface CreateSpecialtyInput {
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface UpdateSpecialtyInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface CreateDoctorInput {
  fullName: string;
  clinicId: string;
  specialtyId: string;
  bio: string | null;
  qualifications: string | null;
  experienceYears: number | null;
  consultationFee: string;
  slotDurationMinutes: number;
  photoUrl: string | null;
  isActive: boolean;
}

export interface UpdateDoctorInput {
  fullName?: string;
  clinicId?: string;
  specialtyId?: string;
  bio?: string | null;
  qualifications?: string | null;
  experienceYears?: number | null;
  consultationFee?: string;
  slotDurationMinutes?: number;
  photoUrl?: string | null;
  isActive?: boolean;
}

export interface CreateWeeklyScheduleInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface UpdateWeeklyScheduleInput {
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
}

export interface CreateManualAvailabilityInput {
  availabilityDate: string;
  startTime: string;
  endTime: string;
}

export interface CreateScheduleExceptionInput {
  exceptionDate: string;
  exceptionType: ScheduleExceptionType;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

export interface CreateReceptionistInput {
  name: string;
  email: string;
  password: string;
  clinicId: string;
}

export interface UpdateReceptionistInput {
  name?: string;
  clinicId?: string;
  isActive?: boolean;
}
