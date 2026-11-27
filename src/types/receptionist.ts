import type { AppointmentStatus } from "@/types/database";

export type ReceptionistErrorCode =
  | "UNAUTHORIZED"
  | "ACCOUNT_INACTIVE"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "ALREADY_CHECKED_IN"
  | "INVALID_STATUS_TRANSITION"
  | "INTERNAL_ERROR";

export interface ReceptionistErrorResponse {
  error: string;
  code: ReceptionistErrorCode;
  fieldErrors?: Record<string, string>;
}

export type ReceptionistStatusTarget = "CHECKED_IN" | "COMPLETED" | "NO_SHOW";

export interface ReceptionistAppointment {
  id: string;
  referenceNumber: string;
  doctorId: string;
  doctorName: string;
  doctorIsActive: boolean;
  specialtyName: string;
  clinicId: string;
  clinicName: string;
  patientName: string;
  patientPhone: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  createdAt: string;
}

export interface ReceptionistDoctorOption {
  id: string;
  fullName: string;
  specialtyName: string;
  isActive: boolean;
}

export interface ReceptionistAppointmentsFilter {
  clinicId?: string;
  doctorId?: string;
  status?: AppointmentStatus;
  date?: string;
  query?: string;
}

export interface ReceptionistTodayCounts {
  total: number;
  confirmed: number;
  checkedIn: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

export interface ReceptionistTodayDashboard {
  todayDate: string;
  clinicId: string;
  clinicName: string;
  counts: ReceptionistTodayCounts;
  appointments: ReceptionistAppointment[];
  doctors: ReceptionistDoctorOption[];
}
