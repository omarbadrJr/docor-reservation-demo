import { z } from "zod";

import { parseAvailabilityDate } from "@/lib/validations/availability";
import { parseCatalogId } from "@/lib/validations/catalog";
import type {
  CancelAppointmentInput,
  CreateAppointmentInput,
  LookupAppointmentQuery,
  RescheduleAppointmentInput,
} from "@/types/booking";

const GENERIC_BOOKING_ERROR = "بيانات الحجز مش مظبوطة، راجعها وحاول تاني.";
const GENERIC_MANAGEMENT_ERROR = "البيانات مش مظبوطة، راجعها وحاول تاني.";
const DOCTOR_ID_ERROR = "رقم الدكتور غير صحيح.";
const BOOKING_ID_ERROR = "رقم تعريف الحجز غير صحيح.";
const APPOINTMENT_DATE_ERROR = "التاريخ غير صحيح.";
const START_TIME_ERROR = "المعاد غير صحيح.";
const PATIENT_NAME_MIN_ERROR = "اكتب اسمك بالكامل (3 حروف على الأقل).";
const PATIENT_NAME_MAX_ERROR = "الاسم طويل أوي، اختصره شوية.";
const PATIENT_PHONE_ERROR = "اكتب رقم موبايل صح (أرقام بس، من 7 لـ 20 رقم).";
const REFERENCE_NUMBER_ERROR = "اكتب رقم الحجز صح (مثلاً DR-8K29P4).";
const LOOKUP_MISSING_ERROR = "اكتب رقم الحجز أو رقم الموبايل عشان ندور عليه.";
const LOOKUP_AMBIGUOUS_ERROR =
  "اختار طريقة بحث واحدة: يا إما رقم الحجز أو رقم الموبايل.";

const PHONE_PATTERN = /^\+?\d{7,20}$/;
const REFERENCE_NUMBER_PATTERN = /^DR-[A-Z0-9]{6}$/;
const START_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeArabicDigits(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x0660),
    )
    .replace(/[\u06f0-\u06f9]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    );
}

/**
 * Normalizes Arabic-Indic and Persian digits to ASCII digits and strips spaces,
 * dashes, and parentheses while keeping an optional leading `+`.
 */
export function normalizePhoneNumber(value: string): string {
  return normalizeArabicDigits(value)
    .trim()
    .replace(/[\s()-]+/g, "");
}

/**
 * Normalizes Arabic-Indic/Persian digits, removes whitespace, and uppercases
 * a booking reference number (e.g. `dr-8k29p4` -> `DR-8K29P4`).
 */
export function normalizeReferenceNumber(value: string): string {
  return normalizeArabicDigits(value).trim().replace(/\s+/g, "").toUpperCase();
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

export const referenceLookupSchema = z.object({
  reference: z
    .string({ error: REFERENCE_NUMBER_ERROR })
    .refine(
      (val) => REFERENCE_NUMBER_PATTERN.test(normalizeReferenceNumber(val)),
      REFERENCE_NUMBER_ERROR,
    ),
});

export type ReferenceLookupValues = z.infer<typeof referenceLookupSchema>;

export const phoneLookupSchema = z.object({
  phone: z
    .string({ error: PATIENT_PHONE_ERROR })
    .refine(
      (val) => PHONE_PATTERN.test(normalizePhoneNumber(val)),
      PATIENT_PHONE_ERROR,
    ),
});

export type PhoneLookupValues = z.infer<typeof phoneLookupSchema>;

function collapseFieldErrors<T extends string>(
  fieldErrors: Partial<Record<T, string>>,
  fallbackError: string,
): { error: string; fieldErrors: Partial<Record<T, string>> } {
  const messages = Object.values(fieldErrors).filter(
    (message): message is string =>
      typeof message === "string" && message.length > 0,
  );
  return {
    error: messages.length === 1 ? messages[0] : fallbackError,
    fieldErrors,
  };
}

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

  if (
    Object.keys(fieldErrors).length > 0 ||
    !doctorId ||
    !appointmentDate ||
    !startTime ||
    !formResult.success
  ) {
    return {
      success: false,
      ...collapseFieldErrors(fieldErrors, GENERIC_BOOKING_ERROR),
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

/**
 * Validates GET /api/appointments/lookup query parameters (`?reference=...` or `?phone=...`).
 */
export function parseLookupQuery(searchParams: URLSearchParams):
  | {
      success: true;
      data: LookupAppointmentQuery;
    }
  | {
      success: false;
      error: string;
      fieldErrors: Partial<Record<"reference" | "phone", string>>;
    } {
  const referenceValues = searchParams
    .getAll("reference")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const phoneValues = searchParams
    .getAll("phone")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (referenceValues.length > 1) {
    return {
      success: false,
      error: REFERENCE_NUMBER_ERROR,
      fieldErrors: { reference: REFERENCE_NUMBER_ERROR },
    };
  }

  if (phoneValues.length > 1) {
    return {
      success: false,
      error: PATIENT_PHONE_ERROR,
      fieldErrors: { phone: PATIENT_PHONE_ERROR },
    };
  }

  const rawReference = referenceValues[0] ?? null;
  const rawPhone = phoneValues[0] ?? null;

  if (rawReference && rawPhone) {
    return {
      success: false,
      error: LOOKUP_AMBIGUOUS_ERROR,
      fieldErrors: {},
    };
  }

  if (!rawReference && !rawPhone) {
    return {
      success: false,
      error: LOOKUP_MISSING_ERROR,
      fieldErrors: {},
    };
  }

  if (rawReference) {
    const reference = normalizeReferenceNumber(rawReference);
    if (!REFERENCE_NUMBER_PATTERN.test(reference)) {
      return {
        success: false,
        error: REFERENCE_NUMBER_ERROR,
        fieldErrors: { reference: REFERENCE_NUMBER_ERROR },
      };
    }
    return {
      success: true,
      data: { type: "reference", reference },
    };
  }

  const phone = normalizePhoneNumber(rawPhone!);
  if (!PHONE_PATTERN.test(phone)) {
    return {
      success: false,
      error: PATIENT_PHONE_ERROR,
      fieldErrors: { phone: PATIENT_PHONE_ERROR },
    };
  }

  return {
    success: true,
    data: { type: "phone", phone },
  };
}

type OwnershipValidationResult =
  | {
      success: true;
      data: CancelAppointmentInput;
      record: Record<string, unknown>;
    }
  | {
      success: false;
      appointmentId: string | null;
      referenceNumber: string | null;
      patientPhone: string | null;
      record: Record<string, unknown>;
      fieldErrors: Partial<
        Record<"appointmentId" | "referenceNumber" | "patientPhone", string>
      >;
    };

function validateBookingOwnership(
  appointmentId: string,
  payload: unknown,
):
  | OwnershipValidationResult
  | {
      nonObject: true;
    } {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { nonObject: true };
  }

  const record = payload as Record<string, unknown>;
  const fieldErrors: Partial<
    Record<"appointmentId" | "referenceNumber" | "patientPhone", string>
  > = {};

  const validAppointmentId = parseCatalogId(appointmentId);
  if (!validAppointmentId) {
    fieldErrors.appointmentId = BOOKING_ID_ERROR;
  }

  const referenceNumber =
    typeof record.referenceNumber === "string"
      ? normalizeReferenceNumber(record.referenceNumber)
      : "";
  if (!REFERENCE_NUMBER_PATTERN.test(referenceNumber)) {
    fieldErrors.referenceNumber = REFERENCE_NUMBER_ERROR;
  }

  const patientPhone =
    typeof record.patientPhone === "string"
      ? normalizePhoneNumber(record.patientPhone)
      : "";
  if (!PHONE_PATTERN.test(patientPhone)) {
    fieldErrors.patientPhone = PATIENT_PHONE_ERROR;
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    !validAppointmentId ||
    !referenceNumber ||
    !patientPhone
  ) {
    return {
      success: false,
      appointmentId: validAppointmentId,
      referenceNumber: REFERENCE_NUMBER_PATTERN.test(referenceNumber)
        ? referenceNumber
        : null,
      patientPhone: PHONE_PATTERN.test(patientPhone) ? patientPhone : null,
      record,
      fieldErrors,
    };
  }

  return {
    success: true,
    data: {
      appointmentId: validAppointmentId,
      referenceNumber,
      patientPhone,
    },
    record,
  };
}

/**
 * Validates and normalizes an incoming cancel-appointment request payload.
 */
export function parseCancelAppointmentInput(
  appointmentId: string,
  payload: unknown,
):
  | {
      success: true;
      data: CancelAppointmentInput;
    }
  | {
      success: false;
      error: string;
      fieldErrors: Partial<Record<keyof CancelAppointmentInput, string>>;
    } {
  const ownership = validateBookingOwnership(appointmentId, payload);
  if ("nonObject" in ownership) {
    return {
      success: false,
      error: GENERIC_MANAGEMENT_ERROR,
      fieldErrors: {},
    };
  }

  if (!ownership.success) {
    return {
      success: false,
      ...collapseFieldErrors(ownership.fieldErrors, GENERIC_MANAGEMENT_ERROR),
    };
  }

  return {
    success: true,
    data: ownership.data,
  };
}

/**
 * Validates and normalizes an incoming reschedule-appointment request payload.
 */
export function parseRescheduleAppointmentInput(
  appointmentId: string,
  payload: unknown,
):
  | {
      success: true;
      data: RescheduleAppointmentInput;
    }
  | {
      success: false;
      error: string;
      fieldErrors: Partial<Record<keyof RescheduleAppointmentInput, string>>;
    } {
  const ownership = validateBookingOwnership(appointmentId, payload);
  if ("nonObject" in ownership) {
    return {
      success: false,
      error: GENERIC_MANAGEMENT_ERROR,
      fieldErrors: {},
    };
  }

  const fieldErrors: Partial<Record<keyof RescheduleAppointmentInput, string>> =
    ownership.success ? {} : { ...ownership.fieldErrors };

  const appointmentDate =
    typeof ownership.record.appointmentDate === "string"
      ? parseAvailabilityDate(ownership.record.appointmentDate)
      : null;
  if (!appointmentDate) {
    fieldErrors.appointmentDate = APPOINTMENT_DATE_ERROR;
  }

  const startTime =
    typeof ownership.record.startTime === "string" &&
    START_TIME_PATTERN.test(ownership.record.startTime)
      ? ownership.record.startTime
      : null;
  if (!startTime) {
    fieldErrors.startTime = START_TIME_ERROR;
  }

  if (
    !ownership.success ||
    !appointmentDate ||
    !startTime ||
    Object.keys(fieldErrors).length > 0
  ) {
    return {
      success: false,
      ...collapseFieldErrors(fieldErrors, GENERIC_MANAGEMENT_ERROR),
    };
  }

  return {
    success: true,
    data: {
      ...ownership.data,
      appointmentDate,
      startTime,
    },
  };
}
