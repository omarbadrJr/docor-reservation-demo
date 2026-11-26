import { z } from "zod";

import { parseAvailabilityDate } from "@/lib/validations/availability";
import { parseCatalogId } from "@/lib/validations/catalog";
import type { CreateAppointmentInput } from "@/types/booking";

const GENERIC_BOOKING_ERROR = "بيانات الحجز مش مظبوطة، راجعها وحاول تاني.";
const DOCTOR_ID_ERROR = "رقم الدكتور غير صحيح.";
const APPOINTMENT_DATE_ERROR = "التاريخ غير صحيح.";
const START_TIME_ERROR = "المعاد غير صحيح.";
const PATIENT_NAME_MIN_ERROR = "اكتب اسمك بالكامل (3 حروف على الأقل).";
const PATIENT_NAME_MAX_ERROR = "الاسم طويل أوي، اختصره شوية.";
const PATIENT_PHONE_ERROR = "اكتب رقم موبايل صح (أرقام بس، من 7 لـ 20 رقم).";

const PHONE_PATTERN = /^\+?\d{7,20}$/;
const START_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Normalizes Arabic-Indic and Persian digits to ASCII digits and strips spaces,
 * dashes, and parentheses while keeping an optional leading `+`.
 */
export function normalizePhoneNumber(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x0660),
    )
    .replace(/[\u06f0-\u06f9]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    )
    .trim()
    .replace(/[\s()-]+/g, "");
}

export const bookingFormSchema = z.object({
  patientName: z
    .string({ error: PATIENT_NAME_MIN_ERROR })
    .refine((val) => val.trim().length >= 3, PATIENT_NAME_MIN_ERROR)
    .refine((val) => val.trim().length <= 100, PATIENT_NAME_MAX_ERROR),
  patientPhone: z
    .string({ error: PATIENT_PHONE_ERROR })
    .refine(
      (val) => PHONE_PATTERN.test(normalizePhoneNumber(val)),
      PATIENT_PHONE_ERROR,
    ),
});

export type BookingFormValues = z.infer<typeof bookingFormSchema>;

/**
 * Validates and normalizes an incoming create-appointment request payload.
 */
export function parseCreateAppointmentInput(payload: unknown):
  | {
      success: true;
      data: CreateAppointmentInput;
    }
  | {
      success: false;
      error: string;
      fieldErrors: Partial<Record<keyof CreateAppointmentInput, string>>;
    } {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return {
      success: false,
      error: GENERIC_BOOKING_ERROR,
      fieldErrors: {},
    };
  }

  const record = payload as Record<string, unknown>;
  const fieldErrors: Partial<Record<keyof CreateAppointmentInput, string>> = {};

  const doctorId =
    typeof record.doctorId === "string" ? parseCatalogId(record.doctorId) : null;
  if (!doctorId) {
    fieldErrors.doctorId = DOCTOR_ID_ERROR;
  }

  const appointmentDate =
    typeof record.appointmentDate === "string"
      ? parseAvailabilityDate(record.appointmentDate)
      : null;
  if (!appointmentDate) {
    fieldErrors.appointmentDate = APPOINTMENT_DATE_ERROR;
  }

  const startTime =
    typeof record.startTime === "string" &&
    START_TIME_PATTERN.test(record.startTime)
      ? record.startTime
      : null;
  if (!startTime) {
    fieldErrors.startTime = START_TIME_ERROR;
  }

  const formResult = bookingFormSchema.safeParse({
    patientName: record.patientName,
    patientPhone: record.patientPhone,
  });

  if (!formResult.success) {
    for (const issue of formResult.error.issues) {
      const field = issue.path[0];
      if (
        (field === "patientName" || field === "patientPhone") &&
        !fieldErrors[field]
      ) {
        fieldErrors[field] = issue.message;
      }
    }
  }

  const messages = Object.values(fieldErrors).filter(
    (message): message is string =>
      typeof message === "string" && message.length > 0,
  );

  if (
    messages.length > 0 ||
    !doctorId ||
    !appointmentDate ||
    !startTime ||
    !formResult.success
  ) {
    return {
      success: false,
      error: messages.length === 1 ? messages[0] : GENERIC_BOOKING_ERROR,
      fieldErrors,
    };
  }

  return {
    success: true,
    data: {
      doctorId,
      appointmentDate,
      startTime,
      patientName: formResult.data.patientName.trim(),
      patientPhone: normalizePhoneNumber(formResult.data.patientPhone),
    },
  };
}
