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
  | "BOOKING_NOT_FOUND"
  | "BOOKING_NOT_MODIFIABLE"
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

export type ManagedBookingData = BookingConfirmationData & {
  isDoctorActive: boolean;
  isPast: boolean;
  canReschedule: boolean;
  canCancel: boolean;
};

export type LookupAppointmentQuery =
  | {
      type: "reference";
      reference: string;
    }
  | {
      type: "phone";
      phone: string;
    };

export type LookupAppointmentsResponse = {
  bookings: ManagedBookingData[];
  todayDate: string;
};

export type RescheduleAppointmentInput = {
  appointmentId: string;
  referenceNumber: string;
  patientPhone: string;
  appointmentDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
};

export type CancelAppointmentInput = {
  appointmentId: string;
  referenceNumber: string;
  patientPhone: string;
};

export type UpdateAppointmentResponse = {
  booking: ManagedBookingData;
  todayDate: string;
};

export type BookingManagementErrorResponse = {
  error: string;
  code: BookingErrorCode;
  fieldErrors?: Record<string, string | undefined>;
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
