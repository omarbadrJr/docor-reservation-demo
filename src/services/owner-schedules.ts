import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ownerJson,
  parseJsonBody,
  requireUuidOrThrow,
  toOwnerErrorResponse,
} from "@/app/api/owner/_shared";
import { requireAdminApi } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseCreateManualAvailabilityInput,
  parseCreateScheduleExceptionInput,
  parseCreateWeeklyScheduleInput,
  parseUpdateWeeklyScheduleInput,
} from "@/lib/validations/owner";
import { OwnerServiceError, mapOwnerDbError } from "@/services/owner-errors";
import type { StaffProfile } from "@/types/auth";
import type {
  AdminRole,
  Database,
  ManualAvailability,
  ScheduleException,
  Tables,
  WeeklySchedule,
} from "@/types/database";
import type {
  CreateManualAvailabilityInput,
  CreateScheduleExceptionInput,
  CreateWeeklyScheduleInput,
  OwnerDoctorSchedules,
  OwnerManualAvailability,
  OwnerScheduleException,
  OwnerWeeklySchedule,
  UpdateWeeklyScheduleInput,
} from "@/types/owner";

const DOCTOR_NOT_FOUND_MESSAGE = "الدكتور ده مش موجود.";
const WEEKLY_SCHEDULE_NOT_FOUND_MESSAGE =
  "الفترة دي مش موجودة في جدول الدكتور.";
const MANUAL_AVAILABILITY_NOT_FOUND_MESSAGE = "الميعاد الإضافي ده مش موجود.";
const SCHEDULE_EXCEPTION_NOT_FOUND_MESSAGE = "الاستثناء ده مش موجود.";

const INVALID_TIME_RANGE_MESSAGE = "وقت النهاية لازم يكون بعد وقت البداية.";
const MISSING_START_TIME_MESSAGE = "اكتب وقت البداية صح (مثل 09:00).";
const MISSING_END_TIME_MESSAGE = "اكتب وقت النهاية صح (مثل 17:00).";

const WEEKLY_SCHEDULE_COLUMNS =
  "id, doctor_id, day_of_week, start_time, end_time, is_active, created_at";
const MANUAL_AVAILABILITY_COLUMNS =
  "id, doctor_id, availability_date, start_time, end_time, created_at";
const SCHEDULE_EXCEPTION_COLUMNS =
  "id, doctor_id, exception_date, exception_type, start_time, end_time, reason, created_at";

export interface OwnerSchedulesHandlerDeps {
  requireAdmin?: (allowedRoles?: readonly AdminRole[]) => Promise<StaffProfile>;
  getAdminClient?: () => SupabaseClient<Database>;
}

type DoctorSummaryRow = {
  id: string;
  full_name: string;
  clinic_id: string;
  specialty_id: string;
  slot_duration_minutes: number;
  is_active: boolean;
};

type NamedEntityRow = {
  id: string;
  name: string;
};

function normalizeTimeToHHMM(value: string): string {
  const parts = value.trim().split(":");
  if (parts.length >= 2 && parts[0].length > 0 && parts[1].length > 0) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  }
  return value.slice(0, 5);
}

function normalizeNullableTimeToHHMM(value: string | null): string | null {
  return value === null ? null : normalizeTimeToHHMM(value);
}

function mapWeeklyScheduleRow(row: WeeklySchedule): OwnerWeeklySchedule {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    dayOfWeek: row.day_of_week,
    startTime: normalizeTimeToHHMM(row.start_time),
    endTime: normalizeTimeToHHMM(row.end_time),
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function mapManualAvailabilityRow(
  row: ManualAvailability,
): OwnerManualAvailability {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    availabilityDate: row.availability_date,
    startTime: normalizeTimeToHHMM(row.start_time),
    endTime: normalizeTimeToHHMM(row.end_time),
    createdAt: row.created_at,
  };
}

function mapScheduleExceptionRow(
  row: ScheduleException,
): OwnerScheduleException {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    exceptionDate: row.exception_date,
    exceptionType: row.exception_type,
    startTime: normalizeNullableTimeToHHMM(row.start_time),
    endTime: normalizeNullableTimeToHHMM(row.end_time),
    reason: row.reason,
    createdAt: row.created_at,
  };
}

async function assertDoctorExists(
  adminClient: SupabaseClient<Database>,
  doctorId: string,
): Promise<void> {
  const { data, error } = await adminClient
    .from("doctors")
    .select("id")
    .eq("id", doctorId)
    .maybeSingle();

  if (error) {
    throw mapOwnerDbError(error, {
      fallback: "حصلت مشكلة وإحنا بنراجع بيانات الدكتور، حاول تاني بعد شوية.",
    });
  }

  if (!data) {
    throw new OwnerServiceError(404, "NOT_FOUND", DOCTOR_NOT_FOUND_MESSAGE);
  }
}

/**
 * Loads a doctor's summary along with their weekly schedules, manual availability
 * windows, and schedule exceptions with times normalized to `HH:MM`.
 */
export async function getDoctorSchedules(
  adminClient: SupabaseClient<Database>,
  doctorId: string,
): Promise<OwnerDoctorSchedules> {
  const { data: doctorData, error: doctorError } = await adminClient
    .from("doctors")
    .select(
      "id, full_name, clinic_id, specialty_id, slot_duration_minutes, is_active",
    )
    .eq("id", doctorId)
    .maybeSingle();

  if (doctorError) {
    throw mapOwnerDbError(doctorError, {
      fallback: "مش قادرين نجيب بيانات الدكتور دلوقتي، حاول تاني بعد شوية.",
    });
  }

  const doctor = doctorData as DoctorSummaryRow | null;
  if (!doctor) {
    throw new OwnerServiceError(404, "NOT_FOUND", DOCTOR_NOT_FOUND_MESSAGE);
  }

  const [
    clinicResult,
    specialtyResult,
    weeklyResult,
    manualResult,
    exceptionsResult,
  ] = await Promise.all([
    adminClient
      .from("clinics")
      .select("id, name")
      .eq("id", doctor.clinic_id)
      .maybeSingle(),
    adminClient
      .from("specialties")
      .select("id, name")
      .eq("id", doctor.specialty_id)
      .maybeSingle(),
    adminClient
      .from("weekly_schedules")
      .select(WEEKLY_SCHEDULE_COLUMNS)
      .eq("doctor_id", doctorId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
    adminClient
      .from("manual_availability")
      .select(MANUAL_AVAILABILITY_COLUMNS)
      .eq("doctor_id", doctorId)
      .order("availability_date", { ascending: true })
      .order("start_time", { ascending: true }),
    adminClient
      .from("schedule_exceptions")
      .select(SCHEDULE_EXCEPTION_COLUMNS)
      .eq("doctor_id", doctorId)
      .order("exception_date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const firstError =
    clinicResult.error ??
    specialtyResult.error ??
    weeklyResult.error ??
    manualResult.error ??
    exceptionsResult.error;

  if (firstError) {
    throw mapOwnerDbError(firstError, {
      fallback: "مش قادرين نجيب جدول الدكتور دلوقتي، حاول تاني بعد شوية.",
    });
  }

  const clinic = clinicResult.data as NamedEntityRow | null;
  const specialty = specialtyResult.data as NamedEntityRow | null;

  return {
    doctor: {
      id: doctor.id,
      fullName: doctor.full_name,
      clinicName: clinic?.name ?? "غير محدد",
      specialtyName: specialty?.name ?? "غير محدد",
      slotDurationMinutes: doctor.slot_duration_minutes,
      isActive: doctor.is_active,
    },
    weeklySchedules: ((weeklyResult.data ?? []) as WeeklySchedule[]).map(
      mapWeeklyScheduleRow,
    ),
    manualAvailabilities: (
      (manualResult.data ?? []) as ManualAvailability[]
    ).map(mapManualAvailabilityRow),
    scheduleExceptions: (
      (exceptionsResult.data ?? []) as ScheduleException[]
    ).map(mapScheduleExceptionRow),
  };
}

/**
 * Adds a recurring weekly working window for a doctor.
 */
export async function createWeeklySchedule(
  adminClient: SupabaseClient<Database>,
  doctorId: string,
  input: CreateWeeklyScheduleInput,
): Promise<OwnerWeeklySchedule> {
  await assertDoctorExists(adminClient, doctorId);

  const startTime = normalizeTimeToHHMM(input.startTime);
  const endTime = normalizeTimeToHHMM(input.endTime);

  if (endTime <= startTime) {
    throw new OwnerServiceError(400, "VALIDATION_ERROR", INVALID_TIME_RANGE_MESSAGE, {
      fieldErrors: { endTime: INVALID_TIME_RANGE_MESSAGE },
    });
  }

  const payload: Tables["weekly_schedules"]["Insert"] = {
    doctor_id: doctorId,
    day_of_week: input.dayOfWeek,
    start_time: startTime,
    end_time: endTime,
    is_active: input.isActive,
  };

  const { data, error } = await adminClient
    .from("weekly_schedules")
    .insert(payload)
    .select(WEEKLY_SCHEDULE_COLUMNS)
    .single();

  if (error || !data) {
    throw mapOwnerDbError(error, {
      conflict: "الفترة دي متسجلة بالفعل لنفس اليوم.",
      invalidReference: DOCTOR_NOT_FOUND_MESSAGE,
      fallback: "مش قادرين نضيف الفترة الأسبوعية دلوقتي، حاول تاني بعد شوية.",
    });
  }

  return mapWeeklyScheduleRow(data as WeeklySchedule);
}

/**
 * Updates a weekly working window scoped strictly to the specified doctor,
 * validating that merged start/end times remain ordered (`endTime > startTime`).
 */
export async function updateWeeklySchedule(
  adminClient: SupabaseClient<Database>,
  doctorId: string,
  scheduleId: string,
  input: UpdateWeeklyScheduleInput,
): Promise<OwnerWeeklySchedule> {
  if (
    input.dayOfWeek === undefined &&
    input.startTime === undefined &&
    input.endTime === undefined &&
    input.isActive === undefined
  ) {
    throw new OwnerServiceError(
      400,
      "VALIDATION_ERROR",
      "لازم تبعت بيان واحد على الأقل للتعديل.",
    );
  }

  const { data: existingData, error: existingError } = await adminClient
    .from("weekly_schedules")
    .select(WEEKLY_SCHEDULE_COLUMNS)
    .eq("id", scheduleId)
    .eq("doctor_id", doctorId)
    .maybeSingle();

  if (existingError) {
    throw mapOwnerDbError(existingError, {
      fallback: "مش قادرين نراجع الفترة الأسبوعية دلوقتي، حاول تاني بعد شوية.",
    });
  }

  const existing = existingData as WeeklySchedule | null;
  if (!existing) {
    throw new OwnerServiceError(
      404,
      "NOT_FOUND",
      WEEKLY_SCHEDULE_NOT_FOUND_MESSAGE,
    );
  }

  const nextStartTime =
    input.startTime !== undefined
      ? normalizeTimeToHHMM(input.startTime)
      : normalizeTimeToHHMM(existing.start_time);
  const nextEndTime =
    input.endTime !== undefined
      ? normalizeTimeToHHMM(input.endTime)
      : normalizeTimeToHHMM(existing.end_time);

  if (nextEndTime <= nextStartTime) {
    throw new OwnerServiceError(
      400,
      "VALIDATION_ERROR",
      INVALID_TIME_RANGE_MESSAGE,
      {
        fieldErrors: { endTime: INVALID_TIME_RANGE_MESSAGE },
      },
    );
  }

  const updates: Tables["weekly_schedules"]["Update"] = {};
  if (input.dayOfWeek !== undefined) {
    updates.day_of_week = input.dayOfWeek;
  }
  if (input.startTime !== undefined) {
    updates.start_time = nextStartTime;
  }
  if (input.endTime !== undefined) {
    updates.end_time = nextEndTime;
  }
  if (input.isActive !== undefined) {
    updates.is_active = input.isActive;
  }

  const { data: updatedData, error: updateError } = await adminClient
    .from("weekly_schedules")
    .update(updates)
    .eq("id", scheduleId)
    .eq("doctor_id", doctorId)
    .select(WEEKLY_SCHEDULE_COLUMNS)
    .maybeSingle();

  if (updateError) {
    throw mapOwnerDbError(updateError, {
      conflict: "الفترة دي متسجلة بالفعل لنفس اليوم.",
      notFound: WEEKLY_SCHEDULE_NOT_FOUND_MESSAGE,
      fallback: "مش قادرين نعدل الفترة الأسبوعية دلوقتي، حاول تاني بعد شوية.",
    });
  }

  const updated = updatedData as WeeklySchedule | null;
  if (!updated) {
    throw new OwnerServiceError(
      404,
      "NOT_FOUND",
      WEEKLY_SCHEDULE_NOT_FOUND_MESSAGE,
    );
  }

  return mapWeeklyScheduleRow(updated);
}

/**
 * Deletes a weekly schedule row scoped strictly to the specified doctor.
 */
export async function deleteWeeklySchedule(
  adminClient: SupabaseClient<Database>,
  doctorId: string,
  scheduleId: string,
): Promise<void> {
  const { data, error } = await adminClient
    .from("weekly_schedules")
    .delete()
    .eq("id", scheduleId)
    .eq("doctor_id", doctorId)
    .select("id");

  if (error) {
    throw mapOwnerDbError(error, {
      fallback: "مش قادرين نحذف الفترة الأسبوعية دلوقتي، حاول تاني بعد شوية.",
    });
  }

  if (!data || data.length === 0) {
    throw new OwnerServiceError(
      404,
      "NOT_FOUND",
      WEEKLY_SCHEDULE_NOT_FOUND_MESSAGE,
    );
  }
}

/**
 * Adds a date-specific extra working window for a doctor.
 */
export async function createManualAvailability(
  adminClient: SupabaseClient<Database>,
  doctorId: string,
  input: CreateManualAvailabilityInput,
): Promise<OwnerManualAvailability> {
  await assertDoctorExists(adminClient, doctorId);

  const startTime = normalizeTimeToHHMM(input.startTime);
  const endTime = normalizeTimeToHHMM(input.endTime);

  if (endTime <= startTime) {
    throw new OwnerServiceError(
      400,
      "VALIDATION_ERROR",
      INVALID_TIME_RANGE_MESSAGE,
      {
        fieldErrors: { endTime: INVALID_TIME_RANGE_MESSAGE },
      },
    );
  }

  const payload: Tables["manual_availability"]["Insert"] = {
    doctor_id: doctorId,
    availability_date: input.availabilityDate,
    start_time: startTime,
    end_time: endTime,
  };

  const { data, error } = await adminClient
    .from("manual_availability")
    .insert(payload)
    .select(MANUAL_AVAILABILITY_COLUMNS)
    .single();

  if (error || !data) {
    throw mapOwnerDbError(error, {
      conflict: "الميعاد الإضافي ده متسجل بالفعل في نفس اليوم والوقت.",
      invalidReference: DOCTOR_NOT_FOUND_MESSAGE,
      fallback: "مش قادرين نضيف الميعاد الإضافي دلوقتي، حاول تاني بعد شوية.",
    });
  }

  return mapManualAvailabilityRow(data as ManualAvailability);
}

/**
 * Deletes a manual availability entry scoped strictly to the specified doctor.
 */
export async function deleteManualAvailability(
  adminClient: SupabaseClient<Database>,
  doctorId: string,
  availabilityId: string,
): Promise<void> {
  const { data, error } = await adminClient
    .from("manual_availability")
    .delete()
    .eq("id", availabilityId)
    .eq("doctor_id", doctorId)
    .select("id");

  if (error) {
    throw mapOwnerDbError(error, {
      fallback: "مش قادرين نحذف الميعاد الإضافي دلوقتي، حاول تاني بعد شوية.",
    });
  }

  if (!data || data.length === 0) {
    throw new OwnerServiceError(
      404,
      "NOT_FOUND",
      MANUAL_AVAILABILITY_NOT_FOUND_MESSAGE,
    );
  }
}

/**
 * Creates a date-specific schedule exception (`CLOSED`, `MODIFIED_HOURS`, or `EXTRA_HOURS`),
 * enforcing null times when `exceptionType === "CLOSED"` and ordered times otherwise.
 */
export async function createScheduleException(
  adminClient: SupabaseClient<Database>,
  doctorId: string,
  input: CreateScheduleExceptionInput,
): Promise<OwnerScheduleException> {
  await assertDoctorExists(adminClient, doctorId);

  let startTime: string | null = null;
  let endTime: string | null = null;

  if (input.exceptionType !== "CLOSED") {
    const fieldErrors: Record<string, string> = {};
    if (!input.startTime) {
      fieldErrors.startTime = MISSING_START_TIME_MESSAGE;
    }
    if (!input.endTime) {
      fieldErrors.endTime = MISSING_END_TIME_MESSAGE;
    }

    if (Object.keys(fieldErrors).length > 0) {
      const messages = Object.values(fieldErrors);
      throw new OwnerServiceError(
        400,
        "VALIDATION_ERROR",
        messages.length === 1
          ? messages[0]
          : "البيانات مش مظبوطة، راجعها وحاول تاني.",
        { fieldErrors },
      );
    }

    startTime = normalizeTimeToHHMM(input.startTime!);
    endTime = normalizeTimeToHHMM(input.endTime!);

    if (endTime <= startTime) {
      throw new OwnerServiceError(
        400,
        "VALIDATION_ERROR",
        INVALID_TIME_RANGE_MESSAGE,
        {
          fieldErrors: { endTime: INVALID_TIME_RANGE_MESSAGE },
        },
      );
    }
  }

  const payload: Tables["schedule_exceptions"]["Insert"] = {
    doctor_id: doctorId,
    exception_date: input.exceptionDate,
    exception_type: input.exceptionType,
    start_time: startTime,
    end_time: endTime,
    reason: input.reason ?? null,
  };

  const { data, error } = await adminClient
    .from("schedule_exceptions")
    .insert(payload)
    .select(SCHEDULE_EXCEPTION_COLUMNS)
    .single();

  if (error || !data) {
    throw mapOwnerDbError(error, {
      invalidReference: DOCTOR_NOT_FOUND_MESSAGE,
      fallback: "مش قادرين نضيف الاستثناء دلوقتي، حاول تاني بعد شوية.",
    });
  }

  return mapScheduleExceptionRow(data as ScheduleException);
}

/**
 * Deletes a schedule exception scoped strictly to the specified doctor.
 */
export async function deleteScheduleException(
  adminClient: SupabaseClient<Database>,
  doctorId: string,
  exceptionId: string,
): Promise<void> {
  const { data, error } = await adminClient
    .from("schedule_exceptions")
    .delete()
    .eq("id", exceptionId)
    .eq("doctor_id", doctorId)
    .select("id");

  if (error) {
    throw mapOwnerDbError(error, {
      fallback: "مش قادرين نحذف الاستثناء دلوقتي، حاول تاني بعد شوية.",
    });
  }

  if (!data || data.length === 0) {
    throw new OwnerServiceError(
      404,
      "NOT_FOUND",
      SCHEDULE_EXCEPTION_NOT_FOUND_MESSAGE,
    );
  }
}

/**
 * Creates the `GET /api/owner/doctors/[id]/schedules` handler.
 */
export function createDoctorSchedulesGetHandler(
  deps: OwnerSchedulesHandlerDeps = {},
): (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleDoctorSchedulesGet(
    _request: Request,
    context: { params: Promise<{ id: string }> },
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const { id } = await context.params;
      const doctorId = requireUuidOrThrow(id, "الدكتور");
      const data = await getDoctorSchedules(getAdminClient(), doctorId);
      return ownerJson(data, { status: 200 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}

/**
 * Creates the `POST /api/owner/doctors/[id]/weekly-schedule` handler.
 */
export function createWeeklySchedulePostHandler(
  deps: OwnerSchedulesHandlerDeps = {},
): (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleWeeklySchedulePost(
    request: Request,
    context: { params: Promise<{ id: string }> },
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const { id } = await context.params;
      const doctorId = requireUuidOrThrow(id, "الدكتور");
      const body = await parseJsonBody(request);
      const parsed = parseCreateWeeklyScheduleInput(body);
      if (!parsed.success) {
        throw new OwnerServiceError(400, "VALIDATION_ERROR", parsed.message, {
          fieldErrors: parsed.fieldErrors,
        });
      }

      const schedule = await createWeeklySchedule(
        getAdminClient(),
        doctorId,
        parsed.data,
      );
      return ownerJson({ schedule }, { status: 201 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}

/**
 * Creates the `PATCH /api/owner/doctors/[id]/weekly-schedule/[scheduleId]` handler.
 */
export function createWeeklySchedulePatchHandler(
  deps: OwnerSchedulesHandlerDeps = {},
): (
  request: Request,
  context: { params: Promise<{ id: string; scheduleId: string }> },
) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleWeeklySchedulePatch(
    request: Request,
    context: { params: Promise<{ id: string; scheduleId: string }> },
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const { id, scheduleId: rawScheduleId } = await context.params;
      const doctorId = requireUuidOrThrow(id, "الدكتور");
      const scheduleId = requireUuidOrThrow(rawScheduleId, "الفترة الأسبوعية");
      const body = await parseJsonBody(request);
      const parsed = parseUpdateWeeklyScheduleInput(body);
      if (!parsed.success) {
        throw new OwnerServiceError(400, "VALIDATION_ERROR", parsed.message, {
          fieldErrors: parsed.fieldErrors,
        });
      }

      const schedule = await updateWeeklySchedule(
        getAdminClient(),
        doctorId,
        scheduleId,
        parsed.data,
      );
      return ownerJson({ schedule }, { status: 200 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}

/**
 * Creates the `DELETE /api/owner/doctors/[id]/weekly-schedule/[scheduleId]` handler.
 */
export function createWeeklyScheduleDeleteHandler(
  deps: OwnerSchedulesHandlerDeps = {},
): (
  request: Request,
  context: { params: Promise<{ id: string; scheduleId: string }> },
) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleWeeklyScheduleDelete(
    _request: Request,
    context: { params: Promise<{ id: string; scheduleId: string }> },
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const { id, scheduleId: rawScheduleId } = await context.params;
      const doctorId = requireUuidOrThrow(id, "الدكتور");
      const scheduleId = requireUuidOrThrow(rawScheduleId, "الفترة الأسبوعية");
      await deleteWeeklySchedule(getAdminClient(), doctorId, scheduleId);
      return ownerJson({ ok: true }, { status: 200 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}

/**
 * Creates the `POST /api/owner/doctors/[id]/manual-availability` handler.
 */
export function createManualAvailabilityPostHandler(
  deps: OwnerSchedulesHandlerDeps = {},
): (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleManualAvailabilityPost(
    request: Request,
    context: { params: Promise<{ id: string }> },
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const { id } = await context.params;
      const doctorId = requireUuidOrThrow(id, "الدكتور");
      const body = await parseJsonBody(request);
      const parsed = parseCreateManualAvailabilityInput(body);
      if (!parsed.success) {
        throw new OwnerServiceError(400, "VALIDATION_ERROR", parsed.message, {
          fieldErrors: parsed.fieldErrors,
        });
      }

      const availability = await createManualAvailability(
        getAdminClient(),
        doctorId,
        parsed.data,
      );
      return ownerJson({ availability }, { status: 201 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}

/**
 * Creates the `DELETE /api/owner/doctors/[id]/manual-availability/[availabilityId]` handler.
 */
export function createManualAvailabilityDeleteHandler(
  deps: OwnerSchedulesHandlerDeps = {},
): (
  request: Request,
  context: { params: Promise<{ id: string; availabilityId: string }> },
) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleManualAvailabilityDelete(
    _request: Request,
    context: { params: Promise<{ id: string; availabilityId: string }> },
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const { id, availabilityId: rawAvailabilityId } = await context.params;
      const doctorId = requireUuidOrThrow(id, "الدكتور");
      const availabilityId = requireUuidOrThrow(
        rawAvailabilityId,
        "الميعاد الإضافي",
      );
      await deleteManualAvailability(getAdminClient(), doctorId, availabilityId);
      return ownerJson({ ok: true }, { status: 200 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}

/**
 * Creates the `POST /api/owner/doctors/[id]/schedule-exceptions` handler.
 */
export function createScheduleExceptionPostHandler(
  deps: OwnerSchedulesHandlerDeps = {},
): (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleScheduleExceptionPost(
    request: Request,
    context: { params: Promise<{ id: string }> },
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const { id } = await context.params;
      const doctorId = requireUuidOrThrow(id, "الدكتور");
      const body = await parseJsonBody(request);
      const parsed = parseCreateScheduleExceptionInput(body);
      if (!parsed.success) {
        throw new OwnerServiceError(400, "VALIDATION_ERROR", parsed.message, {
          fieldErrors: parsed.fieldErrors,
        });
      }

      const exception = await createScheduleException(
        getAdminClient(),
        doctorId,
        parsed.data,
      );
      return ownerJson({ exception }, { status: 201 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}

/**
 * Creates the `DELETE /api/owner/doctors/[id]/schedule-exceptions/[exceptionId]` handler.
 */
export function createScheduleExceptionDeleteHandler(
  deps: OwnerSchedulesHandlerDeps = {},
): (
  request: Request,
  context: { params: Promise<{ id: string; exceptionId: string }> },
) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleScheduleExceptionDelete(
    _request: Request,
    context: { params: Promise<{ id: string; exceptionId: string }> },
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const { id, exceptionId: rawExceptionId } = await context.params;
      const doctorId = requireUuidOrThrow(id, "الدكتور");
      const exceptionId = requireUuidOrThrow(rawExceptionId, "الاستثناء");
      await deleteScheduleException(getAdminClient(), doctorId, exceptionId);
      return ownerJson({ ok: true }, { status: 200 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}
