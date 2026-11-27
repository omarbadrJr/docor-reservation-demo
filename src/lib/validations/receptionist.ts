import { normalizeReferenceNumber } from "@/lib/validations/appointments";
import { parseAvailabilityDate } from "@/lib/validations/availability";
import { parseUuidParam } from "@/lib/validations/owner";
import type { AppointmentStatus } from "@/types/database";
import type {
  ReceptionistAppointmentsFilter,
  ReceptionistStatusTarget,
} from "@/types/receptionist";

export const RECEPTIONIST_STATUS_TARGETS = [
  "CHECKED_IN",
  "COMPLETED",
  "NO_SHOW",
] as const satisfies readonly ReceptionistStatusTarget[];

const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

const REFERENCE_PATTERN = /^DR-[A-Z0-9]{6}$/;
const QR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

const INVALID_REFERENCE_MESSAGE = "رقم الحجز مش صحيح (مثلاً DR-8K29P4).";
const INVALID_QR_TOKEN_MESSAGE =
  "كود QR مش صحيح، جرّب تمسحه تاني أو اكتب رقم الحجز.";
const EMPTY_CODE_MESSAGE = "اكتب رقم الحجز أو امسح كود QR الأول.";
const INVALID_SCANNED_CODE_MESSAGE =
  "الكود أو رقم الحجز ده مش صحيح. اكتب رقم زي DR-8K29P4 أو امسح كود QR.";
const LOOKUP_MISSING_MESSAGE = "اكتب رقم الحجز أو امسح كود QR الأول.";
const LOOKUP_AMBIGUOUS_MESSAGE =
  "اختار طريقة بحث واحدة: يا إما رقم الحجز أو كود QR.";
const INVALID_STATUS_BODY_MESSAGE =
  "الحالة المطلوبة مش صحيحة، راجعها وحاول تاني.";

export type ReceptionistValidationResult<T> =
  | { success: true; data: T }
  | { success: false; message: string; fieldErrors: Record<string, string> };

export type ReceptionistLookupQuery =
  | { type: "reference"; reference: string }
  | { type: "qrToken"; qrToken: string };

export type ScannedOrTypedBookingCode =
  | { type: "reference"; value: string }
  | { type: "qrToken"; value: string }
  | { type: "invalid"; message: string };

function failValidation(
  fieldErrors: Record<string, string>,
  fallbackMessage = "البيانات المبعوتة مش مظبوطة، راجعها وحاول تاني.",
): { success: false; message: string; fieldErrors: Record<string, string> } {
  const messages = Object.values(fieldErrors).filter(Boolean);
  return {
    success: false,
    message: messages.length === 1 ? messages[0] : fallbackMessage,
    fieldErrors,
  };
}

function readSingleQueryParam(
  searchParams: URLSearchParams,
  key: string,
): { ok: true; value: string | undefined } | { ok: false } {
  const values = searchParams
    .getAll(key)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (values.length > 1) {
    return { ok: false };
  }

  return { ok: true, value: values[0] };
}

/**
 * Validates and normalizes a booking reference parameter (`DR-XXXXXX`).
 */
export function parseReceptionistReferenceParam(
  raw: unknown,
): { success: true; reference: string } | { success: false; message: string } {
  if (typeof raw !== "string") {
    return { success: false, message: INVALID_REFERENCE_MESSAGE };
  }

  const normalized = normalizeReferenceNumber(raw);
  if (!REFERENCE_PATTERN.test(normalized)) {
    return { success: false, message: INVALID_REFERENCE_MESSAGE };
  }

  return { success: true, reference: normalized };
}

/**
 * Validates a booking QR token string.
 */
export function parseReceptionistQrToken(
  raw: unknown,
): { success: true; qrToken: string } | { success: false; message: string } {
  if (typeof raw !== "string") {
    return { success: false, message: INVALID_QR_TOKEN_MESSAGE };
  }

  const trimmed = raw.trim();
  if (!QR_TOKEN_PATTERN.test(trimmed)) {
    return { success: false, message: INVALID_QR_TOKEN_MESSAGE };
  }

  return { success: true, qrToken: trimmed };
}

/**
 * Classifies a manually typed booking reference or scanned QR payload into either
 * a normalized reference number or an opaque QR token.
 */
export function parseScannedOrTypedBookingCode(
  raw: string,
  depth = 0,
): ScannedOrTypedBookingCode {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { type: "invalid", message: EMPTY_CODE_MESSAGE };
  }

  if (
    depth === 0 &&
    (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
  ) {
    try {
      const url = new URL(trimmed);
      const nestedValue =
        url.searchParams.get("qrToken") ??
        url.searchParams.get("token") ??
        url.searchParams.get("reference");
      if (nestedValue) {
        return parseScannedOrTypedBookingCode(nestedValue, depth + 1);
      }
    } catch {
      return { type: "invalid", message: INVALID_SCANNED_CODE_MESSAGE };
    }
  }

  const normalizedRef = normalizeReferenceNumber(trimmed);
  if (REFERENCE_PATTERN.test(normalizedRef)) {
    return { type: "reference", value: normalizedRef };
  }

  if (QR_TOKEN_PATTERN.test(trimmed)) {
    return { type: "qrToken", value: trimmed };
  }

  return { type: "invalid", message: INVALID_SCANNED_CODE_MESSAGE };
}

/**
 * Validates `GET /api/receptionist/appointments/lookup` query parameters (`?reference=` or `?qrToken=`).
 */
export function parseReceptionistLookupQuery(
  searchParams: URLSearchParams,
): ReceptionistValidationResult<ReceptionistLookupQuery> {
  const referenceParam = readSingleQueryParam(searchParams, "reference");
  if (!referenceParam.ok) {
    return failValidation({ reference: INVALID_REFERENCE_MESSAGE });
  }

  const qrTokenParam = readSingleQueryParam(searchParams, "qrToken");
  if (!qrTokenParam.ok) {
    return failValidation({ qrToken: INVALID_QR_TOKEN_MESSAGE });
  }

  if (referenceParam.value && qrTokenParam.value) {
    return {
      success: false,
      message: LOOKUP_AMBIGUOUS_MESSAGE,
      fieldErrors: {},
    };
  }

  if (!referenceParam.value && !qrTokenParam.value) {
    return {
      success: false,
      message: LOOKUP_MISSING_MESSAGE,
      fieldErrors: {},
    };
  }

  if (referenceParam.value) {
    const parsedRef = parseReceptionistReferenceParam(referenceParam.value);
    if (!parsedRef.success) {
      return failValidation({ reference: parsedRef.message });
    }

    return {
      success: true,
      data: { type: "reference", reference: parsedRef.reference },
    };
  }

  const parsedQr = parseReceptionistQrToken(qrTokenParam.value);
  if (!parsedQr.success) {
    return failValidation({ qrToken: parsedQr.message });
  }

  return {
    success: true,
    data: { type: "qrToken", qrToken: parsedQr.qrToken },
  };
}

/**
 * Validates `GET /api/receptionist/appointments` filter query parameters.
 */
export function parseReceptionistAppointmentsFilter(
  searchParams: URLSearchParams,
): ReceptionistValidationResult<ReceptionistAppointmentsFilter> {
  const fieldErrors: Record<string, string> = {};
  const data: ReceptionistAppointmentsFilter = {};

  const clinicParam = readSingleQueryParam(searchParams, "clinicId");
  if (!clinicParam.ok) {
    fieldErrors.clinicId = "حدد عيادة واحدة بس في البحث.";
  } else if (clinicParam.value !== undefined) {
    const clinicUuid = parseUuidParam(clinicParam.value, "العيادة");
    if (!clinicUuid.success) {
      fieldErrors.clinicId = clinicUuid.message;
    } else {
      data.clinicId = clinicUuid.id;
    }
  }

  const doctorParam = readSingleQueryParam(searchParams, "doctorId");
  if (!doctorParam.ok) {
    fieldErrors.doctorId = "اختار دكتور واحد بس في البحث.";
  } else if (doctorParam.value !== undefined) {
    const doctorUuid = parseUuidParam(doctorParam.value, "الدكتور");
    if (!doctorUuid.success) {
      fieldErrors.doctorId = doctorUuid.message;
    } else {
      data.doctorId = doctorUuid.id;
    }
  }

  const statusParam = readSingleQueryParam(searchParams, "status");
  if (!statusParam.ok) {
    fieldErrors.status = "اختار حالة واحدة بس في البحث.";
  } else if (statusParam.value !== undefined) {
    if ((APPOINTMENT_STATUSES as readonly string[]).includes(statusParam.value)) {
      data.status = statusParam.value as AppointmentStatus;
    } else {
      fieldErrors.status = "حالة الحجز المختارة مش صحيحة.";
    }
  }

  const dateParam = readSingleQueryParam(searchParams, "date");
  if (!dateParam.ok) {
    fieldErrors.date = "حدد تاريخ واحد بس.";
  } else if (dateParam.value !== undefined) {
    const parsedDate = parseAvailabilityDate(dateParam.value);
    if (!parsedDate) {
      fieldErrors.date = "التاريخ غير صحيح.";
    } else {
      data.date = parsedDate;
    }
  }

  const queryParam = readSingleQueryParam(searchParams, "query");
  if (!queryParam.ok) {
    fieldErrors.query = "اكتب كلمة بحث واحدة.";
  } else if (queryParam.value !== undefined) {
    if (queryParam.value.length > 100) {
      fieldErrors.query = "كلمة البحث طويلة أوي (الحد الأقصى 100 حرف).";
    } else {
      data.query = queryParam.value;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failValidation(
      fieldErrors,
      "بيانات البحث مش مظبوطة، راجعها وحاول تاني.",
    );
  }

  return {
    success: true,
    data,
  };
}

/**
 * Validates `PATCH /api/receptionist/appointments/[reference]/status` request payload.
 */
export function parseReceptionistStatusUpdateInput(
  payload: unknown,
): ReceptionistValidationResult<{ status: ReceptionistStatusTarget }> {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return {
      success: false,
      message: INVALID_STATUS_BODY_MESSAGE,
      fieldErrors: { status: INVALID_STATUS_BODY_MESSAGE },
    };
  }

  const record = payload as Record<string, unknown>;
  if (
    typeof record.status !== "string" ||
    !(RECEPTIONIST_STATUS_TARGETS as readonly string[]).includes(record.status)
  ) {
    return {
      success: false,
      message: INVALID_STATUS_BODY_MESSAGE,
      fieldErrors: { status: INVALID_STATUS_BODY_MESSAGE },
    };
  }

  return {
    success: true,
    data: { status: record.status as ReceptionistStatusTarget },
  };
}
