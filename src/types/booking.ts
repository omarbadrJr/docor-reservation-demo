import type { DoctorAvailability } from "./availability";
import type { AppointmentStatus } from "./database";

export type CreateAppointmentInput = {
  doctorId: string;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  patientName: string;
  patientPhone: string;
};

export type BookingConfirmationData = {
  id: string;
  referenceNumber: string;
  status: AppointmentStatus;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  specialtyName: string;
  clinicName: string;
  clinicAddress: string;
  consultationFee: string;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  qrCodeDataUrl: string;
};

export type BookingErrorCode =
  | "VALIDATION_ERROR"
  | "DOCTOR_UNAVAILABLE"
  | "SLOT_UNAVAILABLE"
  | "INTERNAL_ERROR";

export type CreateAppointmentResponse = {
  booking: BookingConfirmationData;
};

export type CreateAppointmentErrorResponse = {
  error: string;
  code: BookingErrorCode;
  fieldErrors?: Partial<Record<keyof CreateAppointmentInput, string>>;
  availability?: DoctorAvailability;
};

export type BookingDoctorSummary = {
  id: string;
  fullName: string;
  specialtyName: string;
  clinicName: string;
  clinicAddress: string;
  consultationFee: string;
  photoUrl: string | null;
};
