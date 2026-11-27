import { z } from "zod";

import { parseAvailabilityDate } from "@/lib/validations/availability";
import type {
  AppointmentStatus,
  ScheduleExceptionType,
} from "@/types/database";
import type {
  CreateClinicInput,
  CreateDoctorInput,
  CreateManualAvailabilityInput,
  CreateReceptionistInput,
  CreateScheduleExceptionInput,
  CreateSpecialtyInput,
  CreateWeeklyScheduleInput,
  OwnerAppointmentsFilter,
  UpdateClinicInput,
  UpdateDoctorInput,
  UpdateReceptionistInput,
  UpdateSpecialtyInput,
  UpdateWeeklyScheduleInput,
} from "@/types/owner";

const POSTGRES_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const postgresUuidSchema = z.string().regex(POSTGRES_UUID_PATTERN);
const emailValidator = z.email();

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;
const CLINIC_PHONE_PATTERN = /^\+?[\d\s-]+$/;
const FEE_STRING_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const INTEGER_STRING_PATTERN = /^\d+$/;
const CONTROL_OR_WHITESPACE_PATTERN = /[\u0000-\u0020\u007F]/;

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const GENERIC_VALIDATION_ERROR = "البيانات مش مظبوطة، راجعها وحاول تاني.";
const EMPTY_UPDATE_ERROR = "لازم تبعت بيان واحد على الأقل للتعديل.";

const APPOINTMENT_STATUSES = [
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const satisfies readonly AppointmentStatus[];

const SCHEDULE_EXCEPTION_TYPES = [
  "CLOSED",
  "MODIFIED_HOURS",
  "EXTRA_HOURS",
] as const satisfies readonly ScheduleExceptionType[];

export type OwnerValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      message: string;
      fieldErrors: Record<string, string>;
    };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeArabicDigits(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x0660),
    )
    .replace(/[\u06f0-\u06f9]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    );
}

function failValidation<T>(
  fieldErrors: Record<string, string>,
  fallbackMessage = GENERIC_VALIDATION_ERROR,
): OwnerValidationResult<T> {
  const messages = Object.values(fieldErrors).filter(
    (message) => message.length > 0,
  );
  return {
    success: false,
    message: messages.length === 1 ? messages[0] : fallbackMessage,
    fieldErrors,
  };
}

function hasAnyDefinedField(
  record: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return keys.some((key) => record[key] !== undefined);
}

function parseRequiredTrimmedString(
  raw: unknown,
  options: {
    min?: number;
    max: number;
    requiredError: string;
    minError?: string;
    maxError: string;
  },
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: options.requiredError };
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: options.requiredError };
  }

  if (options.min !== undefined && trimmed.length < options.min) {
    return { ok: false, error: options.minError ?? options.requiredError };
  }

  if (trimmed.length > options.max) {
    return { ok: false, error: options.maxError };
  }

  return { ok: true, value: trimmed };
}

function parseOptionalNullableString(
  raw: unknown,
  options: {
    max: number;
    typeError: string;
    maxError: string;
  },
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }

  if (typeof raw !== "string") {
    return { ok: false, error: options.typeError };
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }

  if (trimmed.length > options.max) {
    return { ok: false, error: options.maxError };
  }

  return { ok: true, value: trimmed };
}

function parseBooleanField(
  raw: unknown,
  errorMessage: string,
): { ok: true; value: boolean } | { ok: false; error: string } {
  if (typeof raw !== "boolean") {
    return { ok: false, error: errorMessage };
  }
  return { ok: true, value: raw };
}

function parseIntegerInRange(
  raw: unknown,
  options: {
    min: number;
    max: number;
    error: string;
  },
): { ok: true; value: number } | { ok: false; error: string } {
  let value: number;
  if (typeof raw === "number") {
    value = raw;
  } else if (typeof raw === "string") {
    const normalized = normalizeArabicDigits(raw).trim();
    if (!INTEGER_STRING_PATTERN.test(normalized)) {
      return { ok: false, error: options.error };
    }
    value = Number(normalized);
  } else {
    return { ok: false, error: options.error };
  }

  if (!Number.isInteger(value) || value < options.min || value > options.max) {
    return { ok: false, error: options.error };
  }

  return { ok: true, value };
}

function parseExperienceYears(
  raw: unknown,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const error = "سنين الخبرة لازم تكون رقم صحيح من 0 لـ 70.";
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }

  if (typeof raw === "string") {
    const normalized = normalizeArabicDigits(raw).trim();
    if (normalized.length === 0) {
      return { ok: true, value: null };
    }
    if (!INTEGER_STRING_PATTERN.test(normalized)) {
      return { ok: false, error };
    }
    const parsed = Number(normalized);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 70) {
      return { ok: false, error };
    }
    return { ok: true, value: parsed };
  }

  if (typeof raw === "number") {
    if (!Number.isInteger(raw) || raw < 0 || raw > 70) {
      return { ok: false, error };
    }
    return { ok: true, value: raw };
  }

  return { ok: false, error };
}

function parseConsultationFee(
  raw: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  const error = "سعر الكشف لازم يكون رقم صحيح أو عشري من 0 لـ 100000.";
  let numericValue: number;

  if (typeof raw === "number") {
    if (
      !Number.isFinite(raw) ||
      raw < 0 ||
      raw > 100000 ||
      Math.abs(raw * 100 - Math.round(raw * 100)) > 1e-6
    ) {
      return { ok: false, error };
    }
    numericValue = raw;
  } else if (typeof raw === "string") {
    const normalized = normalizeArabicDigits(raw).trim();
    if (!FEE_STRING_PATTERN.test(normalized)) {
      return { ok: false, error };
    }
    numericValue = Number(normalized);
    if (
      !Number.isFinite(numericValue) ||
      numericValue < 0 ||
      numericValue > 100000
    ) {
      return { ok: false, error };
    }
  } else {
    return { ok: false, error };
  }

  return { ok: true, value: numericValue.toFixed(2) };
}

function parsePhotoUrl(
  raw: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const error =
    "رابط الصورة لازم يبدأ بـ /doctors/ أو https:// ويكون رابط صحيح.";

  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }

  if (typeof raw !== "string") {
    return { ok: false, error };
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }

  if (trimmed.length > 2048 || CONTROL_OR_WHITESPACE_PATTERN.test(trimmed)) {
    return { ok: false, error };
  }

  if (trimmed.startsWith("/doctors/")) {
    const rest = trimmed.slice("/doctors/".length);
    if (
      rest.length === 0 ||
      trimmed.includes("..") ||
      trimmed.includes("\\") ||
      trimmed.includes("//")
    ) {
      return { ok: false, error };
    }
    return { ok: true, value: trimmed };
  }

  if (/^https:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (
        parsed.protocol === "https:" &&
        parsed.hostname.length > 0 &&
        !parsed.username &&
        !parsed.password
      ) {
        return { ok: true, value: trimmed };
      }
    } catch {
      return { ok: false, error };
    }
  }

  return { ok: false, error };
}

function parseClinicPhone(
  raw: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  const requiredError = "اكتب رقم تليفون العيادة.";
  const invalidError =
    "اكتب رقم تليفون صحيح (من 6 لـ 20 خانة بأرقام أو مسافات أو - أو +).";

  if (typeof raw !== "string") {
    return { ok: false, error: requiredError };
  }

  const normalized = normalizeArabicDigits(raw).trim();
  if (normalized.length === 0) {
    return { ok: false, error: requiredError };
  }

  if (
    normalized.length < 6 ||
    normalized.length > 20 ||
    !CLINIC_PHONE_PATTERN.test(normalized) ||
    !/\d/.test(normalized)
  ) {
    return { ok: false, error: invalidError };
  }

  return { ok: true, value: normalized };
}

function normalizeTime(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = normalizeArabicDigits(raw).trim();
  const match = TIME_PATTERN.exec(trimmed);
  if (!match) {
    return null;
  }

  return `${match[1]}:${match[2]}`;
}

function parseCalendarDate(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  return parseAvailabilityDate(normalizeArabicDigits(raw).trim());
}

/**
 * Validates a Postgres-compatible UUID string (including deterministic seed UUIDs).
 */
export function parseUuidParam(
  value: unknown,
  label?: string,
): { success: true; id: string } | { success: false; message: string } {
  const parsed = postgresUuidSchema.safeParse(value);
  if (!parsed.success) {
    return {
      success: false,
      message: label ? `رقم تعريف ${label} مش صحيح.` : "رقم التعريف مش صحيح.",
    };
  }

  return {
    success: true,
    id: parsed.data,
  };
}

/**
 * Validates and normalizes a create-clinic request payload.
 */
export function parseCreateClinicInput(
  payload: unknown,
): OwnerValidationResult<CreateClinicInput> {
  if (!isPlainRecord(payload)) {
    return failValidation({});
  }

  const fieldErrors: Record<string, string> = {};

  const nameResult = parseRequiredTrimmedString(payload.name, {
    max: 120,
    requiredError: "اكتب اسم العيادة.",
    maxError: "اسم العيادة طويل أوي (الحد الأقصى 120 حرف).",
  });
  if (!nameResult.ok) {
    fieldErrors.name = nameResult.error;
  }

  const addressResult = parseRequiredTrimmedString(payload.address, {
    max: 240,
    requiredError: "اكتب عنوان العيادة.",
    maxError: "عنوان العيادة طويل أوي (الحد الأقصى 240 حرف).",
  });
  if (!addressResult.ok) {
    fieldErrors.address = addressResult.error;
  }

  const phoneResult = parseClinicPhone(payload.phone);
  if (!phoneResult.ok) {
    fieldErrors.phone = phoneResult.error;
  }

  let isActive = true;
  if (payload.isActive !== undefined) {
    const activeResult = parseBooleanField(
      payload.isActive,
      "حالة العيادة لازم تكون صح أو غلط.",
    );
    if (!activeResult.ok) {
      fieldErrors.isActive = activeResult.error;
    } else {
      isActive = activeResult.value;
    }
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    !nameResult.ok ||
    !addressResult.ok ||
    !phoneResult.ok
  ) {
    return failValidation(fieldErrors);
  }

  return {
    success: true,
    data: {
      name: nameResult.value,
      address: addressResult.value,
      phone: phoneResult.value,
      isActive,
    },
  };
}

/**
 * Validates and normalizes an update-clinic request payload.
 */
export function parseUpdateClinicInput(
  payload: unknown,
): OwnerValidationResult<UpdateClinicInput> {
  if (!isPlainRecord(payload)) {
    return failValidation({});
  }

  if (!hasAnyDefinedField(payload, ["name", "address", "phone", "isActive"])) {
    return failValidation({}, EMPTY_UPDATE_ERROR);
  }

  const fieldErrors: Record<string, string> = {};
  const data: UpdateClinicInput = {};

  if (payload.name !== undefined) {
    const nameResult = parseRequiredTrimmedString(payload.name, {
      max: 120,
      requiredError: "اكتب اسم العيادة.",
      maxError: "اسم العيادة طويل أوي (الحد الأقصى 120 حرف).",
    });
    if (!nameResult.ok) {
      fieldErrors.name = nameResult.error;
    } else {
      data.name = nameResult.value;
    }
  }

  if (payload.address !== undefined) {
    const addressResult = parseRequiredTrimmedString(payload.address, {
      max: 240,
      requiredError: "اكتب عنوان العيادة.",
      maxError: "عنوان العيادة طويل أوي (الحد الأقصى 240 حرف).",
    });
    if (!addressResult.ok) {
      fieldErrors.address = addressResult.error;
    } else {
      data.address = addressResult.value;
    }
  }

  if (payload.phone !== undefined) {
    const phoneResult = parseClinicPhone(payload.phone);
    if (!phoneResult.ok) {
      fieldErrors.phone = phoneResult.error;
    } else {
      data.phone = phoneResult.value;
    }
  }

  if (payload.isActive !== undefined) {
    const activeResult = parseBooleanField(
      payload.isActive,
      "حالة العيادة لازم تكون صح أو غلط.",
    );
    if (!activeResult.ok) {
      fieldErrors.isActive = activeResult.error;
    } else {
      data.isActive = activeResult.value;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failValidation(fieldErrors);
  }

  return {
    success: true,
    data,
  };
}

/**
 * Validates and normalizes a create-specialty request payload.
 */
export function parseCreateSpecialtyInput(
  payload: unknown,
): OwnerValidationResult<CreateSpecialtyInput> {
  if (!isPlainRecord(payload)) {
    return failValidation({});
  }

  const fieldErrors: Record<string, string> = {};

  const nameResult = parseRequiredTrimmedString(payload.name, {
    max: 100,
    requiredError: "اكتب اسم التخصص.",
    maxError: "اسم التخصص طويل أوي (الحد الأقصى 100 حرف).",
  });
  if (!nameResult.ok) {
    fieldErrors.name = nameResult.error;
  }

  const descriptionResult = parseOptionalNullableString(payload.description, {
    max: 400,
    typeError: "وصف التخصص لازم يكون نص.",
    maxError: "وصف التخصص طويل أوي (الحد الأقصى 400 حرف).",
  });
  if (!descriptionResult.ok) {
    fieldErrors.description = descriptionResult.error;
  }

  let isActive = true;
  if (payload.isActive !== undefined) {
    const activeResult = parseBooleanField(
      payload.isActive,
      "حالة التخصص لازم تكون صح أو غلط.",
    );
    if (!activeResult.ok) {
      fieldErrors.isActive = activeResult.error;
    } else {
      isActive = activeResult.value;
    }
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    !nameResult.ok ||
    !descriptionResult.ok
  ) {
    return failValidation(fieldErrors);
  }

  return {
    success: true,
    data: {
      name: nameResult.value,
      description: descriptionResult.value,
      isActive,
    },
  };
}

/**
 * Validates and normalizes an update-specialty request payload.
 */
export function parseUpdateSpecialtyInput(
  payload: unknown,
): OwnerValidationResult<UpdateSpecialtyInput> {
  if (!isPlainRecord(payload)) {
    return failValidation({});
  }

  if (!hasAnyDefinedField(payload, ["name", "description", "isActive"])) {
    return failValidation({}, EMPTY_UPDATE_ERROR);
  }

  const fieldErrors: Record<string, string> = {};
  const data: UpdateSpecialtyInput = {};

  if (payload.name !== undefined) {
    const nameResult = parseRequiredTrimmedString(payload.name, {
      max: 100,
      requiredError: "اكتب اسم التخصص.",
      maxError: "اسم التخصص طويل أوي (الحد الأقصى 100 حرف).",
    });
    if (!nameResult.ok) {
      fieldErrors.name = nameResult.error;
    } else {
      data.name = nameResult.value;
    }
  }

  if (payload.description !== undefined) {
    const descriptionResult = parseOptionalNullableString(payload.description, {
      max: 400,
      typeError: "وصف التخصص لازم يكون نص.",
      maxError: "وصف التخصص طويل أوي (الحد الأقصى 400 حرف).",
    });
    if (!descriptionResult.ok) {
      fieldErrors.description = descriptionResult.error;
    } else {
      data.description = descriptionResult.value;
    }
  }

  if (payload.isActive !== undefined) {
    const activeResult = parseBooleanField(
      payload.isActive,
      "حالة التخصص لازم تكون صح أو غلط.",
    );
    if (!activeResult.ok) {
      fieldErrors.isActive = activeResult.error;
    } else {
      data.isActive = activeResult.value;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failValidation(fieldErrors);
  }

  return {
    success: true,
    data,
  };
}

/**
 * Validates and normalizes a create-doctor request payload.
 */
export function parseCreateDoctorInput(
  payload: unknown,
): OwnerValidationResult<CreateDoctorInput> {
  if (!isPlainRecord(payload)) {
    return failValidation({});
  }

  const fieldErrors: Record<string, string> = {};

  const fullNameResult = parseRequiredTrimmedString(payload.fullName, {
    min: 2,
    max: 120,
    requiredError: "اكتب اسم الدكتور.",
    minError: "اسم الدكتور قصير أوي (حرفين على الأقل).",
    maxError: "اسم الدكتور طويل أوي (الحد الأقصى 120 حرف).",
  });
  if (!fullNameResult.ok) {
    fieldErrors.fullName = fullNameResult.error;
  }

  const clinicUuid = parseUuidParam(payload.clinicId, "العيادة");
  if (!clinicUuid.success) {
    fieldErrors.clinicId = clinicUuid.message;
  }

  const specialtyUuid = parseUuidParam(payload.specialtyId, "التخصص");
  if (!specialtyUuid.success) {
    fieldErrors.specialtyId = specialtyUuid.message;
  }

  const bioResult = parseOptionalNullableString(payload.bio, {
    max: 1000,
    typeError: "النبذة لازم تكون نص.",
    maxError: "النبذة طويلة أوي (الحد الأقصى 1000 حرف).",
  });
  if (!bioResult.ok) {
    fieldErrors.bio = bioResult.error;
  }

  const qualificationsResult = parseOptionalNullableString(
    payload.qualifications,
    {
      max: 500,
      typeError: "المؤهلات لازم تكون نص.",
      maxError: "المؤهلات طويلة أوي (الحد الأقصى 500 حرف).",
    },
  );
  if (!qualificationsResult.ok) {
    fieldErrors.qualifications = qualificationsResult.error;
  }

  const experienceResult = parseExperienceYears(payload.experienceYears);
  if (!experienceResult.ok) {
    fieldErrors.experienceYears = experienceResult.error;
  }

  const feeResult = parseConsultationFee(payload.consultationFee);
  if (!feeResult.ok) {
    fieldErrors.consultationFee = feeResult.error;
  }

  const slotResult = parseIntegerInRange(payload.slotDurationMinutes, {
    min: 5,
    max: 480,
    error: "مدة الكشف لازم تكون رقم صحيح من 5 لـ 480 دقيقة.",
  });
  if (!slotResult.ok) {
    fieldErrors.slotDurationMinutes = slotResult.error;
  }

  const photoUrlResult = parsePhotoUrl(payload.photoUrl);
  if (!photoUrlResult.ok) {
    fieldErrors.photoUrl = photoUrlResult.error;
  }

  let isActive = true;
  if (payload.isActive !== undefined) {
    const activeResult = parseBooleanField(
      payload.isActive,
      "حالة الدكتور لازم تكون صح أو غلط.",
    );
    if (!activeResult.ok) {
      fieldErrors.isActive = activeResult.error;
    } else {
      isActive = activeResult.value;
    }
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    !fullNameResult.ok ||
    !clinicUuid.success ||
    !specialtyUuid.success ||
    !bioResult.ok ||
    !qualificationsResult.ok ||
    !experienceResult.ok ||
    !feeResult.ok ||
    !slotResult.ok ||
    !photoUrlResult.ok
  ) {
    return failValidation(fieldErrors);
  }

  return {
    success: true,
    data: {
      fullName: fullNameResult.value,
      clinicId: clinicUuid.id,
      specialtyId: specialtyUuid.id,
      bio: bioResult.value,
      qualifications: qualificationsResult.value,
      experienceYears: experienceResult.value,
      consultationFee: feeResult.value,
      slotDurationMinutes: slotResult.value,
      photoUrl: photoUrlResult.value,
      isActive,
    },
  };
}

/**
 * Validates and normalizes an update-doctor request payload.
 */
export function parseUpdateDoctorInput(
  payload: unknown,
): OwnerValidationResult<UpdateDoctorInput> {
  if (!isPlainRecord(payload)) {
    return failValidation({});
  }

  if (
    !hasAnyDefinedField(payload, [
      "fullName",
      "clinicId",
      "specialtyId",
      "bio",
      "qualifications",
      "experienceYears",
      "consultationFee",
      "slotDurationMinutes",
      "photoUrl",
      "isActive",
    ])
  ) {
    return failValidation({}, EMPTY_UPDATE_ERROR);
  }

  const fieldErrors: Record<string, string> = {};
  const data: UpdateDoctorInput = {};

  if (payload.fullName !== undefined) {
    const fullNameResult = parseRequiredTrimmedString(payload.fullName, {
      min: 2,
      max: 120,
      requiredError: "اكتب اسم الدكتور.",
      minError: "اسم الدكتور قصير أوي (حرفين على الأقل).",
      maxError: "اسم الدكتور طويل أوي (الحد الأقصى 120 حرف).",
    });
    if (!fullNameResult.ok) {
      fieldErrors.fullName = fullNameResult.error;
    } else {
      data.fullName = fullNameResult.value;
    }
  }

  if (payload.clinicId !== undefined) {
    const clinicUuid = parseUuidParam(payload.clinicId, "العيادة");
    if (!clinicUuid.success) {
      fieldErrors.clinicId = clinicUuid.message;
    } else {
      data.clinicId = clinicUuid.id;
    }
  }

  if (payload.specialtyId !== undefined) {
    const specialtyUuid = parseUuidParam(payload.specialtyId, "التخصص");
    if (!specialtyUuid.success) {
      fieldErrors.specialtyId = specialtyUuid.message;
    } else {
      data.specialtyId = specialtyUuid.id;
    }
  }

  if (payload.bio !== undefined) {
    const bioResult = parseOptionalNullableString(payload.bio, {
      max: 1000,
      typeError: "النبذة لازم تكون نص.",
      maxError: "النبذة طويلة أوي (الحد الأقصى 1000 حرف).",
    });
    if (!bioResult.ok) {
      fieldErrors.bio = bioResult.error;
    } else {
      data.bio = bioResult.value;
    }
  }

  if (payload.qualifications !== undefined) {
    const qualificationsResult = parseOptionalNullableString(
      payload.qualifications,
      {
        max: 500,
        typeError: "المؤهلات لازم تكون نص.",
        maxError: "المؤهلات طويلة أوي (الحد الأقصى 500 حرف).",
      },
    );
    if (!qualificationsResult.ok) {
      fieldErrors.qualifications = qualificationsResult.error;
    } else {
      data.qualifications = qualificationsResult.value;
    }
  }

  if (payload.experienceYears !== undefined) {
    const experienceResult = parseExperienceYears(payload.experienceYears);
    if (!experienceResult.ok) {
      fieldErrors.experienceYears = experienceResult.error;
    } else {
      data.experienceYears = experienceResult.value;
    }
  }

  if (payload.consultationFee !== undefined) {
    const feeResult = parseConsultationFee(payload.consultationFee);
    if (!feeResult.ok) {
      fieldErrors.consultationFee = feeResult.error;
    } else {
      data.consultationFee = feeResult.value;
    }
  }

  if (payload.slotDurationMinutes !== undefined) {
    const slotResult = parseIntegerInRange(payload.slotDurationMinutes, {
      min: 5,
      max: 480,
      error: "مدة الكشف لازم تكون رقم صحيح من 5 لـ 480 دقيقة.",
    });
    if (!slotResult.ok) {
      fieldErrors.slotDurationMinutes = slotResult.error;
    } else {
      data.slotDurationMinutes = slotResult.value;
    }
  }

  if (payload.photoUrl !== undefined) {
    const photoUrlResult = parsePhotoUrl(payload.photoUrl);
    if (!photoUrlResult.ok) {
      fieldErrors.photoUrl = photoUrlResult.error;
    } else {
      data.photoUrl = photoUrlResult.value;
    }
  }

  if (payload.isActive !== undefined) {
    const activeResult = parseBooleanField(
      payload.isActive,
      "حالة الدكتور لازم تكون صح أو غلط.",
    );
    if (!activeResult.ok) {
      fieldErrors.isActive = activeResult.error;
    } else {
      data.isActive = activeResult.value;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failValidation(fieldErrors);
  }

  return {
    success: true,
    data,
  };
}

/**
 * Validates an uploaded doctor photo's MIME type, byte size, and magic header.
 */
export function validateDoctorPhotoFile(
  file: { type: string; size: number },
  bytes: Uint8Array,
):
  | {
      success: true;
      contentType: "image/jpeg" | "image/png" | "image/webp";
      extension: "jpg" | "png" | "webp";
    }
  | {
      success: false;
      message: string;
    } {
  const mimeType = typeof file.type === "string" ? file.type.trim().toLowerCase() : "";
  if (
    mimeType !== "image/jpeg" &&
    mimeType !== "image/png" &&
    mimeType !== "image/webp"
  ) {
    return {
      success: false,
      message: "نوع الصورة مش مدعوم. ارفع صورة JPG أو PNG أو WebP.",
    };
  }

  if (
    !Number.isFinite(file.size) ||
    file.size < 1 ||
    bytes.byteLength < 1
  ) {
    return {
      success: false,
      message: "ملف الصورة فاضي، اختار صورة تانية.",
    };
  }

  if (file.size > MAX_PHOTO_BYTES || bytes.byteLength > MAX_PHOTO_BYTES) {
    return {
      success: false,
      message: "حجم الصورة كبير أوي، أقصى حجم مسموح بيه 5 ميجا.",
    };
  }

  if (mimeType === "image/jpeg") {
    const isJpeg =
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;
    if (!isJpeg) {
      return {
        success: false,
        message: "محتوى الملف مش صورة JPG صحيحة.",
      };
    }
    return { success: true, contentType: "image/jpeg", extension: "jpg" };
  }

  if (mimeType === "image/png") {
    const isPng =
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;
    if (!isPng) {
      return {
        success: false,
        message: "محتوى الملف مش صورة PNG صحيحة.",
      };
    }
    return { success: true, contentType: "image/png", extension: "png" };
  }

  const isWebp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (!isWebp) {
    return {
      success: false,
      message: "محتوى الملف مش صورة WebP صحيحة.",
    };
  }

  return { success: true, contentType: "image/webp", extension: "webp" };
}

/**
 * Validates and normalizes a create-weekly-schedule request payload.
 */
export function parseCreateWeeklyScheduleInput(
  payload: unknown,
): OwnerValidationResult<CreateWeeklyScheduleInput> {
  if (!isPlainRecord(payload)) {
    return failValidation({});
  }

  const fieldErrors: Record<string, string> = {};

  const dayResult = parseIntegerInRange(payload.dayOfWeek, {
    min: 0,
    max: 6,
    error: "اختار يوم صحيح من أيام الأسبوع.",
  });
  if (!dayResult.ok) {
    fieldErrors.dayOfWeek = dayResult.error;
  }

  const startTime = normalizeTime(payload.startTime);
  if (!startTime) {
    fieldErrors.startTime = "اكتب وقت البداية صح (مثل 09:00).";
  }

  const endTime = normalizeTime(payload.endTime);
  if (!endTime) {
    fieldErrors.endTime = "اكتب وقت النهاية صح (مثل 17:00).";
  }

  if (startTime && endTime && endTime <= startTime) {
    fieldErrors.endTime = "وقت النهاية لازم يكون بعد وقت البداية.";
  }

  let isActive = true;
  if (payload.isActive !== undefined) {
    const activeResult = parseBooleanField(
      payload.isActive,
      "حالة الموعد الأسبوعي لازم تكون صح أو غلط.",
    );
    if (!activeResult.ok) {
      fieldErrors.isActive = activeResult.error;
    } else {
      isActive = activeResult.value;
    }
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    !dayResult.ok ||
    !startTime ||
    !endTime
  ) {
    return failValidation(fieldErrors);
  }

  return {
    success: true,
    data: {
      dayOfWeek: dayResult.value,
      startTime,
      endTime,
      isActive,
    },
  };
}

/**
 * Validates and normalizes an update-weekly-schedule request payload.
 */
export function parseUpdateWeeklyScheduleInput(
  payload: unknown,
): OwnerValidationResult<UpdateWeeklyScheduleInput> {
  if (!isPlainRecord(payload)) {
    return failValidation({});
  }

  if (
    !hasAnyDefinedField(payload, [
      "dayOfWeek",
      "startTime",
      "endTime",
      "isActive",
    ])
  ) {
    return failValidation({}, EMPTY_UPDATE_ERROR);
  }

  const fieldErrors: Record<string, string> = {};
  const data: UpdateWeeklyScheduleInput = {};

  if (payload.dayOfWeek !== undefined) {
    const dayResult = parseIntegerInRange(payload.dayOfWeek, {
      min: 0,
      max: 6,
      error: "اختار يوم صحيح من أيام الأسبوع.",
    });
    if (!dayResult.ok) {
      fieldErrors.dayOfWeek = dayResult.error;
    } else {
      data.dayOfWeek = dayResult.value;
    }
  }

  if (payload.startTime !== undefined) {
    const startTime = normalizeTime(payload.startTime);
    if (!startTime) {
      fieldErrors.startTime = "اكتب وقت البداية صح (مثل 09:00).";
    } else {
      data.startTime = startTime;
    }
  }

  if (payload.endTime !== undefined) {
    const endTime = normalizeTime(payload.endTime);
    if (!endTime) {
      fieldErrors.endTime = "اكتب وقت النهاية صح (مثل 17:00).";
    } else {
      data.endTime = endTime;
    }
  }

  if (data.startTime && data.endTime && data.endTime <= data.startTime) {
    fieldErrors.endTime = "وقت النهاية لازم يكون بعد وقت البداية.";
  }

  if (payload.isActive !== undefined) {
    const activeResult = parseBooleanField(
      payload.isActive,
      "حالة الموعد الأسبوعي لازم تكون صح أو غلط.",
    );
    if (!activeResult.ok) {
      fieldErrors.isActive = activeResult.error;
    } else {
      data.isActive = activeResult.value;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failValidation(fieldErrors);
  }

  return {
    success: true,
    data,
  };
}

/**
 * Validates and normalizes a create-manual-availability request payload.
 */
export function parseCreateManualAvailabilityInput(
  payload: unknown,
): OwnerValidationResult<CreateManualAvailabilityInput> {
  if (!isPlainRecord(payload)) {
    return failValidation({});
  }

  const fieldErrors: Record<string, string> = {};

  const availabilityDate = parseCalendarDate(payload.availabilityDate);
  if (!availabilityDate) {
    fieldErrors.availabilityDate = "اختار تاريخ صحيح بصيغة YYYY-MM-DD.";
  }

  const startTime = normalizeTime(payload.startTime);
  if (!startTime) {
    fieldErrors.startTime = "اكتب وقت البداية صح (مثل 09:00).";
  }

  const endTime = normalizeTime(payload.endTime);
  if (!endTime) {
    fieldErrors.endTime = "اكتب وقت النهاية صح (مثل 17:00).";
  }

  if (startTime && endTime && endTime <= startTime) {
    fieldErrors.endTime = "وقت النهاية لازم يكون بعد وقت البداية.";
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    !availabilityDate ||
    !startTime ||
    !endTime
  ) {
    return failValidation(fieldErrors);
  }

  return {
    success: true,
    data: {
      availabilityDate,
      startTime,
      endTime,
    },
  };
}

function isBlankOrNullish(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim().length === 0)
  );
}

/**
 * Validates and normalizes a create-schedule-exception request payload.
 */
export function parseCreateScheduleExceptionInput(
  payload: unknown,
): OwnerValidationResult<CreateScheduleExceptionInput> {
  if (!isPlainRecord(payload)) {
    return failValidation({});
  }

  const fieldErrors: Record<string, string> = {};

  const exceptionDate = parseCalendarDate(payload.exceptionDate);
  if (!exceptionDate) {
    fieldErrors.exceptionDate = "اختار تاريخ صحيح للاستثناء بصيغة YYYY-MM-DD.";
  }

  const exceptionType =
    typeof payload.exceptionType === "string" &&
    (SCHEDULE_EXCEPTION_TYPES as readonly string[]).includes(
      payload.exceptionType,
    )
      ? (payload.exceptionType as ScheduleExceptionType)
      : null;

  if (!exceptionType) {
    fieldErrors.exceptionType = "اختار نوع استثناء صحيح.";
  }

  const reasonResult = parseOptionalNullableString(payload.reason, {
    max: 300,
    typeError: "سبب الاستثناء لازم يكون نص.",
    maxError: "سبب الاستثناء طويل أوي (الحد الأقصى 300 حرف).",
  });
  if (!reasonResult.ok) {
    fieldErrors.reason = reasonResult.error;
  }

  let startTime: string | null = null;
  let endTime: string | null = null;

  if (exceptionType === "CLOSED") {
    if (!isBlankOrNullish(payload.startTime)) {
      fieldErrors.startTime = "ماينفعش تحدد وقت بداية في يوم إجازة.";
    }
    if (!isBlankOrNullish(payload.endTime)) {
      fieldErrors.endTime = "ماينفعش تحدد وقت نهاية في يوم إجازة.";
    }
  } else if (exceptionType !== null) {
    startTime = normalizeTime(payload.startTime);
    if (!startTime) {
      fieldErrors.startTime = "اكتب وقت البداية صح (مثل 09:00).";
    }

    endTime = normalizeTime(payload.endTime);
    if (!endTime) {
      fieldErrors.endTime = "اكتب وقت النهاية صح (مثل 17:00).";
    }

    if (startTime && endTime && endTime <= startTime) {
      fieldErrors.endTime = "وقت النهاية لازم يكون بعد وقت البداية.";
    }
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    !exceptionDate ||
    !exceptionType ||
    !reasonResult.ok
  ) {
    return failValidation(fieldErrors);
  }

  return {
    success: true,
    data: {
      exceptionDate,
      exceptionType,
      startTime,
      endTime,
      reason: reasonResult.value,
    },
  };
}

/**
 * Validates and normalizes a create-receptionist request payload.
 */
export function parseCreateReceptionistInput(
  payload: unknown,
): OwnerValidationResult<CreateReceptionistInput> {
  if (!isPlainRecord(payload)) {
    return failValidation({});
  }

  const fieldErrors: Record<string, string> = {};

  const nameResult = parseRequiredTrimmedString(payload.name, {
    min: 2,
    max: 120,
    requiredError: "اكتب اسم موظف الاستقبال.",
    minError: "الاسم قصير أوي (حرفين على الأقل).",
    maxError: "الاسم طويل أوي (الحد الأقصى 120 حرف).",
  });
  if (!nameResult.ok) {
    fieldErrors.name = nameResult.error;
  }

  let email = "";
  if (typeof payload.email !== "string" || payload.email.trim().length === 0) {
    fieldErrors.email = "اكتب البريد الإلكتروني.";
  } else {
    const normalizedEmail = payload.email.trim().toLowerCase();
    if (!emailValidator.safeParse(normalizedEmail).success) {
      fieldErrors.email = "اكتب بريد إلكتروني صحيح.";
    } else {
      email = normalizedEmail;
    }
  }

  let password = "";
  if (typeof payload.password !== "string" || payload.password.trim().length === 0) {
    fieldErrors.password = "اكتب كلمة المرور.";
  } else if (payload.password.length < 8) {
    fieldErrors.password = "كلمة المرور لازم تكون 8 حروف أو أرقام على الأقل.";
  } else if (payload.password.length > 128) {
    fieldErrors.password = "كلمة المرور طويلة جداً (الحد الأقصى 128 حرف).";
  } else {
    password = payload.password;
  }

  const clinicUuid = parseUuidParam(payload.clinicId, "العيادة");
  if (!clinicUuid.success) {
    fieldErrors.clinicId = clinicUuid.message;
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    !nameResult.ok ||
    !email ||
    !password ||
    !clinicUuid.success
  ) {
    return failValidation(fieldErrors);
  }

  return {
    success: true,
    data: {
      name: nameResult.value,
      email,
      password,
      clinicId: clinicUuid.id,
    },
  };
}

/**
 * Validates and normalizes an update-receptionist request payload.
 */
export function parseUpdateReceptionistInput(
  payload: unknown,
): OwnerValidationResult<UpdateReceptionistInput> {
  if (!isPlainRecord(payload)) {
    return failValidation({});
  }

  if (!hasAnyDefinedField(payload, ["name", "clinicId", "isActive"])) {
    return failValidation({}, EMPTY_UPDATE_ERROR);
  }

  const fieldErrors: Record<string, string> = {};
  const data: UpdateReceptionistInput = {};

  if (payload.name !== undefined) {
    const nameResult = parseRequiredTrimmedString(payload.name, {
      min: 2,
      max: 120,
      requiredError: "اكتب اسم موظف الاستقبال.",
      minError: "الاسم قصير أوي (حرفين على الأقل).",
      maxError: "الاسم طويل أوي (الحد الأقصى 120 حرف).",
    });
    if (!nameResult.ok) {
      fieldErrors.name = nameResult.error;
    } else {
      data.name = nameResult.value;
    }
  }

  if (payload.clinicId !== undefined) {
    const clinicUuid = parseUuidParam(payload.clinicId, "العيادة");
    if (!clinicUuid.success) {
      fieldErrors.clinicId = clinicUuid.message;
    } else {
      data.clinicId = clinicUuid.id;
    }
  }

  if (payload.isActive !== undefined) {
    const activeResult = parseBooleanField(
      payload.isActive,
      "حالة الحساب لازم تكون صح أو غلط.",
    );
    if (!activeResult.ok) {
      fieldErrors.isActive = activeResult.error;
    } else {
      data.isActive = activeResult.value;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failValidation(fieldErrors);
  }

  return {
    success: true,
    data,
  };
}

function readSingleParam(
  source:
    | URLSearchParams
    | Record<string, string | string[] | undefined>,
  key: string,
): { ok: true; value: string | undefined } | { ok: false } {
  let values: string[];
  if (source instanceof URLSearchParams) {
    values = source
      .getAll(key)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  } else {
    const raw = source[key];
    if (raw === undefined) {
      values = [];
    } else if (Array.isArray(raw)) {
      values = raw
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    } else {
      const trimmed = raw.trim();
      values = trimmed.length > 0 ? [trimmed] : [];
    }
  }

  if (values.length > 1) {
    return { ok: false };
  }

  return { ok: true, value: values[0] };
}

/**
 * Validates and normalizes filter parameters for the owner appointments view.
 */
export function parseOwnerAppointmentsFilter(
  searchParams:
    | URLSearchParams
    | Record<string, string | string[] | undefined>,
): OwnerValidationResult<OwnerAppointmentsFilter> {
  const fieldErrors: Record<string, string> = {};
  const data: OwnerAppointmentsFilter = {};

  const clinicParam = readSingleParam(searchParams, "clinicId");
  if (!clinicParam.ok) {
    fieldErrors.clinicId = "اختار عيادة واحدة بس في البحث.";
  } else if (clinicParam.value !== undefined) {
    const clinicUuid = parseUuidParam(clinicParam.value, "العيادة");
    if (!clinicUuid.success) {
      fieldErrors.clinicId = clinicUuid.message;
    } else {
      data.clinicId = clinicUuid.id;
    }
  }

  const doctorParam = readSingleParam(searchParams, "doctorId");
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

  const statusParam = readSingleParam(searchParams, "status");
  if (!statusParam.ok) {
    fieldErrors.status = "اختار حالة واحدة بس في البحث.";
  } else if (statusParam.value !== undefined) {
    if (
      (APPOINTMENT_STATUSES as readonly string[]).includes(statusParam.value)
    ) {
      data.status = statusParam.value as AppointmentStatus;
    } else {
      fieldErrors.status = "حالة الحجز المختارة مش صحيحة.";
    }
  }

  const dateParam = readSingleParam(searchParams, "date");
  if (!dateParam.ok) {
    fieldErrors.date = "حدد تاريخ واحد بس.";
  } else if (dateParam.value !== undefined) {
    const parsedDate = parseCalendarDate(dateParam.value);
    if (!parsedDate) {
      fieldErrors.date = "التاريخ غير صحيح.";
    } else {
      data.date = parsedDate;
    }
  }

  const dateFromParam = readSingleParam(searchParams, "dateFrom");
  if (!dateFromParam.ok) {
    fieldErrors.dateFrom = "حدد تاريخ بداية واحد بس.";
  } else if (dateFromParam.value !== undefined) {
    const parsedFrom = parseCalendarDate(dateFromParam.value);
    if (!parsedFrom) {
      fieldErrors.dateFrom = "تاريخ البداية غير صحيح.";
    } else {
      data.dateFrom = parsedFrom;
    }
  }

  const dateToParam = readSingleParam(searchParams, "dateTo");
  if (!dateToParam.ok) {
    fieldErrors.dateTo = "حدد تاريخ نهاية واحد بس.";
  } else if (dateToParam.value !== undefined) {
    const parsedTo = parseCalendarDate(dateToParam.value);
    if (!parsedTo) {
      fieldErrors.dateTo = "تاريخ النهاية غير صحيح.";
    } else {
      data.dateTo = parsedTo;
    }
  }

  if (data.dateFrom && data.dateTo && data.dateFrom > data.dateTo) {
    fieldErrors.dateTo = "تاريخ النهاية لازم يكون بعد أو نفس تاريخ البداية.";
  }

  const queryParam = readSingleParam(searchParams, "query");
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
    return failValidation(fieldErrors);
  }

  return {
    success: true,
    data,
  };
}
