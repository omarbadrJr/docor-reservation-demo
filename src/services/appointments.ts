import { generateBookingQrDataUrl } from "@/lib/qr";
import type { DoctorAvailability } from "@/types/availability";
import type {
  BookingConfirmationData,
  BookingErrorCode,
  CreateAppointmentInput,
} from "@/types/booking";
import type { Appointment } from "@/types/database";

import { getDoctorAvailability } from "./availability";
import { getPublicDoctorById } from "./doctors";
import type { CatalogClient } from "./specialties";

const DOCTOR_UNAVAILABLE_MESSAGE = "الدكتور ده غير متاح للحجز دلوقتي.";
const SLOT_UNAVAILABLE_MESSAGE =
  "المعاد ده اتحجز قبلك بشوية. اختار معاد تاني من المواعيد المتاحة.";
const PATIENT_NAME_ERROR = "اكتب اسمك بالكامل (3 حروف على الأقل).";
const PATIENT_PHONE_ERROR = "اكتب رقم موبايل صح (أرقام بس، من 7 لـ 20 رقم).";
const INTERNAL_BOOKING_ERROR =
  "حصلت مشكلة وإحنا بنسجل الحجز، حاول تاني بعد شوية.";

export class BookingServiceError extends Error {
  readonly status: 400 | 404 | 409 | 500;
  readonly code: BookingErrorCode;
  readonly availability?: DoctorAvailability;
  readonly fieldErrors?: Partial<Record<keyof CreateAppointmentInput, string>>;

  constructor(
    status: 400 | 404 | 409 | 500,
    code: BookingErrorCode,
    message: string,
    details?: {
      availability?: DoctorAvailability;
      fieldErrors?: Partial<Record<keyof CreateAppointmentInput, string>>;
    },
  ) {
    super(message);
    this.name = "BookingServiceError";
    this.status = status;
    this.code = code;
    this.availability = details?.availability;
    this.fieldErrors = details?.fieldErrors;
  }
}

function extractAppointmentRow(
  data: Appointment | Appointment[] | null,
): Appointment | null {
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function isReferenceNumberCollision(
  error: { code?: string; message?: string } | null,
): boolean {
  return (
    error !== null &&
    error.code === "23505" &&
    (error.message ?? "").includes("reference_number")
  );
}

/**
 * Validates doctor availability, creates an appointment transactionally via the
 * `create_appointment` RPC, maps database/concurrency errors to structured Arabic
 * service errors, and attaches a generated QR code data URL.
 */
export async function createAppointment(
  client: CatalogClient,
  input: CreateAppointmentInput,
  options?: { generateQr?: (token: string) => Promise<string> },
): Promise<BookingConfirmationData> {
  const doctor = await getPublicDoctorById(client, input.doctorId);
  if (!doctor) {
    throw new BookingServiceError(
      404,
      "DOCTOR_UNAVAILABLE",
      DOCTOR_UNAVAILABLE_MESSAGE,
    );
  }

  const rpcArgs = {
    p_doctor_id: input.doctorId,
    p_date: input.appointmentDate,
    p_start: input.startTime,
    p_patient_name: input.patientName,
    p_patient_phone: input.patientPhone,
  };

  let rpcResult = await client.rpc("create_appointment", rpcArgs);
  if (isReferenceNumberCollision(rpcResult.error)) {
    rpcResult = await client.rpc("create_appointment", rpcArgs);
  }

  if (rpcResult.error) {
    const code = rpcResult.error.code;
    const message = rpcResult.error.message ?? "";

    if (message.includes("Doctor is not available for booking")) {
      throw new BookingServiceError(
        404,
        "DOCTOR_UNAVAILABLE",
        DOCTOR_UNAVAILABLE_MESSAGE,
      );
    }

    if (
      message.includes("Slot is not available") ||
      message.includes("Invalid slot time") ||
      code === "23P01" ||
      message.includes("appointments_no_active_overlap")
    ) {
      const availability = await getDoctorAvailability(
        client,
        input.doctorId,
        input.appointmentDate,
      );
      if (!availability) {
        throw new BookingServiceError(
          404,
          "DOCTOR_UNAVAILABLE",
          DOCTOR_UNAVAILABLE_MESSAGE,
        );
      }

      throw new BookingServiceError(
        409,
        "SLOT_UNAVAILABLE",
        SLOT_UNAVAILABLE_MESSAGE,
        { availability },
      );
    }

    if (message.includes("Patient name")) {
      throw new BookingServiceError(400, "VALIDATION_ERROR", PATIENT_NAME_ERROR, {
        fieldErrors: { patientName: PATIENT_NAME_ERROR },
      });
    }

    if (message.includes("Patient phone")) {
      throw new BookingServiceError(400, "VALIDATION_ERROR", PATIENT_PHONE_ERROR, {
        fieldErrors: { patientPhone: PATIENT_PHONE_ERROR },
      });
    }

    throw new BookingServiceError(500, "INTERNAL_ERROR", INTERNAL_BOOKING_ERROR);
  }

  const appointment = extractAppointmentRow(rpcResult.data);
  if (!appointment) {
    throw new BookingServiceError(500, "INTERNAL_ERROR", INTERNAL_BOOKING_ERROR);
  }

  const qrCodeDataUrl = await (options?.generateQr ?? generateBookingQrDataUrl)(
    appointment.qr_token,
  );

  return {
    id: appointment.id,
    referenceNumber: appointment.reference_number,
    status: appointment.status,
    patientName: appointment.patient_name,
    patientPhone: appointment.patient_phone,
    doctorId: doctor.id,
    doctorName: doctor.fullName,
    specialtyName: doctor.specialtyName,
    clinicName: doctor.clinicName,
    clinicAddress: doctor.clinicAddress,
    consultationFee: doctor.consultationFee,
    appointmentDate: appointment.appointment_date,
    startTime: appointment.start_time.slice(0, 5),
    endTime: appointment.end_time.slice(0, 5),
    qrCodeDataUrl,
  };
}
