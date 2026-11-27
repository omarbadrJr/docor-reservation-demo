import type { SupabaseClient } from "@supabase/supabase-js";

import {
  parseReceptionistJsonBody,
  receptionistJson,
  toReceptionistErrorResponse,
} from "@/app/api/receptionist/_shared";
import { requireAdminApi } from "@/lib/auth/guards";
import { getCairoNow, type CairoNow } from "@/lib/cairo-time";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseReceptionistAppointmentsFilter,
  parseReceptionistLookupQuery,
  parseReceptionistReferenceParam,
  parseReceptionistStatusUpdateInput,
} from "@/lib/validations/receptionist";
import { AuthServiceError, assertClinicAccess } from "@/services/auth";
import {
  ReceptionistServiceError,
  mapReceptionistDbError,
} from "@/services/receptionist-errors";
import type { StaffProfile } from "@/types/auth";
import type {
  AdminRole,
  AppointmentStatus,
  Database,
} from "@/types/database";
import type {
  ReceptionistAppointment,
  ReceptionistAppointmentsFilter,
  ReceptionistDoctorOption,
  ReceptionistStatusTarget,
  ReceptionistTodayDashboard,
} from "@/types/receptionist";

export { ReceptionistServiceError } from "@/services/receptionist-errors";

const APPOINTMENT_SELECT =
  "id, reference_number, doctor_id, clinic_id, patient_name, patient_phone, appointment_date, start_time, end_time, status, created_at";

const UNKNOWN_DOCTOR_NAME = "دكتور غير معروف";
const UNKNOWN_CLINIC_NAME = "عيادة غير معروفة";
const UNKNOWN_SPECIALTY_NAME = "تخصص غير معروف";

const FORBIDDEN_CLINIC_MESSAGE =
  "معندكش صلاحية تدخل على بيانات عيادة تانية.";
const LOAD_APPOINTMENTS_ERROR_MESSAGE =
  "حصلت مشكلة وإحنا بنحمّل الحجوزات، حاول تاني بعد شوية.";
const LOAD_DOCTORS_ERROR_MESSAGE =
  "حصلت مشكلة وإحنا بنحمّل قايمة الدكاترة، حاول تاني بعد شوية.";
const APPOINTMENT_NOT_FOUND_MESSAGE =
  "الحجز ده مش موجود في عيادتك. اتأكد من رقم الحجز وحاول تاني.";
const QR_APPOINTMENT_NOT_FOUND_MESSAGE =
  "كود QR ده مش مربوط بحجز في عيادتك. اتأكد من الكود أو دوّر برقم الحجز.";
const UPDATE_APPOINTMENT_ERROR_MESSAGE =
  "حصلت مشكلة وإحنا بنحدّث حالة الحجز، حاول تاني بعد شوية.";
const STALE_STATUS_MESSAGE =
  "حالة الحجز اتغيّرت دلوقتي، حدّث الصفحة وراجع بيانات الحجز.";

type AppointmentRow = {
  id: string;
  reference_number: string;
  doctor_id: string;
  clinic_id: string;
  patient_name: string;
  patient_phone: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  created_at: string;
};

type DoctorLookupRow = {
  id: string;
  full_name: string;
  specialty_id: string;
  is_active: boolean;
};

type ClinicLookupRow = {
  id: string;
  name: string;
};

type SpecialtyLookupRow = {
  id: string;
  name: string;
};

export interface ReceptionistHandlerDeps {
  requireAdmin?: (allowedRoles?: readonly AdminRole[]) => Promise<StaffProfile>;
  getAdminClient?: () => SupabaseClient<Database>;
}

function trimTime(value: string): string {
  return value.slice(0, 5);
}

function normalizeSearchText(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x0660),
    )
    .replace(/[\u06f0-\u06f9]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    )
    .trim()
    .toLowerCase();
}

function compareTodayAppointmentsOrder(
  first: ReceptionistAppointment,
  second: ReceptionistAppointment,
): number {
  return (
    first.startTime.localeCompare(second.startTime) ||
    first.createdAt.localeCompare(second.createdAt)
  );
}

function compareAllAppointmentsOrder(
  first: ReceptionistAppointment,
  second: ReceptionistAppointment,
): number {
  return (
    second.appointmentDate.localeCompare(first.appointmentDate) ||
    first.startTime.localeCompare(second.startTime) ||
    second.createdAt.localeCompare(first.createdAt)
  );
}

/**
 * Verifies the staff profile is an active receptionist bound to a clinic.
 */
export function assertReceptionistClinic(staff: StaffProfile): string {
  if (staff.role !== "RECEPTIONIST" || !staff.clinicId) {
    throw new AuthServiceError(403, "FORBIDDEN", FORBIDDEN_CLINIC_MESSAGE);
  }
  return staff.clinicId;
}

async function hydrateAppointmentRows(
  adminClient: SupabaseClient<Database>,
  rows: readonly AppointmentRow[],
  fallbackErrorMessage: string,
): Promise<ReceptionistAppointment[]> {
  if (rows.length === 0) {
    return [];
  }

  const doctorIds = Array.from(new Set(rows.map((row) => row.doctor_id)));
  const clinicIds = Array.from(new Set(rows.map((row) => row.clinic_id)));

  const [doctorsResult, clinicsResult] = await Promise.all([
    adminClient
      .from("doctors")
      .select("id, full_name, specialty_id, is_active")
      .in("id", doctorIds),
    adminClient.from("clinics").select("id, name").in("id", clinicIds),
  ]);

  if (doctorsResult.error) {
    throw mapReceptionistDbError(doctorsResult.error, {
      fallback: fallbackErrorMessage,
    });
  }

  if (clinicsResult.error) {
    throw mapReceptionistDbError(clinicsResult.error, {
      fallback: fallbackErrorMessage,
    });
  }

  const doctorRows = (doctorsResult.data ?? []) as DoctorLookupRow[];
  const clinicRows = (clinicsResult.data ?? []) as ClinicLookupRow[];

  const specialtyIds = Array.from(
    new Set(doctorRows.map((doctor) => doctor.specialty_id)),
  );

  let specialtyRows: SpecialtyLookupRow[] = [];
  if (specialtyIds.length > 0) {
    const specialtiesResult = await adminClient
      .from("specialties")
      .select("id, name")
      .in("id", specialtyIds);

    if (specialtiesResult.error) {
      throw mapReceptionistDbError(specialtiesResult.error, {
        fallback: fallbackErrorMessage,
      });
    }

    specialtyRows = (specialtiesResult.data ?? []) as SpecialtyLookupRow[];
  }

  const doctorsById = new Map(doctorRows.map((doctor) => [doctor.id, doctor]));
  const clinicsById = new Map(clinicRows.map((clinic) => [clinic.id, clinic]));
  const specialtiesById = new Map(
    specialtyRows.map((specialty) => [specialty.id, specialty]),
  );

  return rows.map((row) => {
    const doctor = doctorsById.get(row.doctor_id);
    const clinic = clinicsById.get(row.clinic_id);
    const specialty = doctor
      ? specialtiesById.get(doctor.specialty_id)
      : undefined;

    return {
      id: row.id,
      referenceNumber: row.reference_number,
      doctorId: row.doctor_id,
      doctorName: doctor?.full_name ?? UNKNOWN_DOCTOR_NAME,
      doctorIsActive: doctor?.is_active ?? false,
      specialtyName: specialty?.name ?? UNKNOWN_SPECIALTY_NAME,
      clinicId: row.clinic_id,
      clinicName: clinic?.name ?? UNKNOWN_CLINIC_NAME,
      patientName: row.patient_name,
      patientPhone: row.patient_phone,
      appointmentDate: row.appointment_date,
      startTime: trimTime(row.start_time),
      endTime: trimTime(row.end_time),
      status: row.status,
      createdAt: row.created_at,
    };
  });
}

/**
 * Lists all doctors assigned to the receptionist's clinic (including inactive
 * doctors so staff can filter historical appointments).
 */
export async function listReceptionistClinicDoctors(
  adminClient: SupabaseClient<Database>,
  clinicId: string,
): Promise<ReceptionistDoctorOption[]> {
  const { data: doctorsData, error: doctorsError } = await adminClient
    .from("doctors")
    .select("id, full_name, specialty_id, is_active")
    .eq("clinic_id", clinicId)
    .order("full_name", { ascending: true });

  if (doctorsError) {
    throw mapReceptionistDbError(doctorsError, {
      fallback: LOAD_DOCTORS_ERROR_MESSAGE,
    });
  }

  const doctorRows = (doctorsData ?? []) as DoctorLookupRow[];
  if (doctorRows.length === 0) {
    return [];
  }

  const specialtyIds = Array.from(
    new Set(doctorRows.map((doctor) => doctor.specialty_id)),
  );
  const { data: specialtiesData, error: specialtiesError } = await adminClient
    .from("specialties")
    .select("id, name")
    .in("id", specialtyIds);

  if (specialtiesError) {
    throw mapReceptionistDbError(specialtiesError, {
      fallback: LOAD_DOCTORS_ERROR_MESSAGE,
    });
  }

  const specialtiesById = new Map(
    ((specialtiesData ?? []) as SpecialtyLookupRow[]).map((specialty) => [
      specialty.id,
      specialty.name,
    ]),
  );

  return doctorRows
    .map((doctor) => ({
      id: doctor.id,
      fullName: doctor.full_name,
      specialtyName:
        specialtiesById.get(doctor.specialty_id) ?? UNKNOWN_SPECIALTY_NAME,
      isActive: doctor.is_active,
    }))
    .sort((first, second) => first.fullName.localeCompare(second.fullName, "ar"));
}

/**
 * Lists appointments strictly scoped to the receptionist's assigned clinic.
 */
export async function listReceptionistAppointments(
  adminClient: SupabaseClient<Database>,
  clinicId: string,
  filter: ReceptionistAppointmentsFilter = {},
): Promise<ReceptionistAppointment[]> {
  let query = adminClient
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("clinic_id", clinicId);

  if (filter.doctorId) {
    query = query.eq("doctor_id", filter.doctorId);
  }
  if (filter.status) {
    query = query.eq("status", filter.status);
  }
  if (filter.date) {
    query = query.eq("appointment_date", filter.date);
  }

  const { data, error } = await query
    .order("appointment_date", { ascending: false })
    .order("start_time", { ascending: true });

  if (error) {
    throw mapReceptionistDbError(error, {
      fallback: LOAD_APPOINTMENTS_ERROR_MESSAGE,
    });
  }

  const rows = (data ?? []) as AppointmentRow[];
  let hydrated = await hydrateAppointmentRows(
    adminClient,
    rows,
    LOAD_APPOINTMENTS_ERROR_MESSAGE,
  );

  if (filter.query) {
    const normalizedQuery = normalizeSearchText(filter.query);
    if (normalizedQuery.length > 0) {
      hydrated = hydrated.filter((appointment) => {
        const fields = [
          appointment.referenceNumber,
          appointment.patientName,
          appointment.patientPhone,
          appointment.doctorName,
        ];
        return fields.some((field) =>
          normalizeSearchText(field).includes(normalizedQuery),
        );
      });
    }
  }

  return filter.date
    ? hydrated.sort(compareTodayAppointmentsOrder)
    : hydrated.sort(compareAllAppointmentsOrder);
}

/**
 * Loads today's appointments (`Africa/Cairo` date), summary counts, and clinic
 * doctors strictly for the authenticated receptionist's assigned clinic.
 */
export async function getReceptionistTodayDashboard(
  adminClient: SupabaseClient<Database>,
  staff: StaffProfile,
  now: CairoNow = getCairoNow(),
): Promise<ReceptionistTodayDashboard> {
  const clinicId = assertReceptionistClinic(staff);
  const todayDate = now.date;

  const [appointments, doctors] = await Promise.all([
    listReceptionistAppointments(adminClient, clinicId, { date: todayDate }),
    listReceptionistClinicDoctors(adminClient, clinicId),
  ]);

  let clinicName = staff.clinicName?.trim() || "";
  if (!clinicName) {
    const { data: clinicData } = await adminClient
      .from("clinics")
      .select("id, name")
      .eq("id", clinicId)
      .maybeSingle();
    const clinicRow = clinicData as ClinicLookupRow | null;
    clinicName = clinicRow?.name ?? UNKNOWN_CLINIC_NAME;
  }

  const confirmed = appointments.filter(
    (item) => item.status === "CONFIRMED",
  ).length;
  const checkedIn = appointments.filter(
    (item) => item.status === "CHECKED_IN",
  ).length;
  const completed = appointments.filter(
    (item) => item.status === "COMPLETED",
  ).length;
  const cancelled = appointments.filter(
    (item) => item.status === "CANCELLED",
  ).length;
  const noShow = appointments.filter(
    (item) => item.status === "NO_SHOW",
  ).length;

  return {
    todayDate,
    clinicId,
    clinicName,
    counts: {
      total: confirmed + checkedIn + completed + noShow,
      confirmed,
      checkedIn,
      completed,
      cancelled,
      noShow,
    },
    appointments,
    doctors,
  };
}

/**
 * Retrieves a single appointment by reference number strictly within the
 * receptionist's assigned clinic. Returns 404 for cross-clinic references.
 */
export async function getReceptionistAppointmentByReference(
  adminClient: SupabaseClient<Database>,
  clinicId: string,
  reference: string,
): Promise<ReceptionistAppointment> {
  const { data, error } = await adminClient
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("clinic_id", clinicId)
    .eq("reference_number", reference)
    .maybeSingle();

  if (error) {
    throw mapReceptionistDbError(error, {
      notFound: APPOINTMENT_NOT_FOUND_MESSAGE,
      fallback: LOAD_APPOINTMENTS_ERROR_MESSAGE,
    });
  }

  const row = data as AppointmentRow | null;
  if (!row) {
    throw new ReceptionistServiceError(
      404,
      "NOT_FOUND",
      APPOINTMENT_NOT_FOUND_MESSAGE,
    );
  }

  const [hydrated] = await hydrateAppointmentRows(
    adminClient,
    [row],
    LOAD_APPOINTMENTS_ERROR_MESSAGE,
  );
  return hydrated;
}

/**
 * Retrieves a single appointment by opaque QR token strictly within the
 * receptionist's assigned clinic. Returns 404 for cross-clinic tokens and never
 * returns `qr_token` in the payload.
 */
export async function getReceptionistAppointmentByQrToken(
  adminClient: SupabaseClient<Database>,
  clinicId: string,
  qrToken: string,
): Promise<ReceptionistAppointment> {
  const { data, error } = await adminClient
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("clinic_id", clinicId)
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (error) {
    throw mapReceptionistDbError(error, {
      notFound: QR_APPOINTMENT_NOT_FOUND_MESSAGE,
      fallback: LOAD_APPOINTMENTS_ERROR_MESSAGE,
    });
  }

  const row = data as AppointmentRow | null;
  if (!row) {
    throw new ReceptionistServiceError(
      404,
      "NOT_FOUND",
      QR_APPOINTMENT_NOT_FOUND_MESSAGE,
    );
  }

  const [hydrated] = await hydrateAppointmentRows(
    adminClient,
    [row],
    LOAD_APPOINTMENTS_ERROR_MESSAGE,
  );
  return hydrated;
}

async function fetchRawAppointmentForClinic(
  adminClient: SupabaseClient<Database>,
  clinicId: string,
  reference: string,
): Promise<AppointmentRow> {
  const { data, error } = await adminClient
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("clinic_id", clinicId)
    .eq("reference_number", reference)
    .maybeSingle();

  if (error) {
    throw mapReceptionistDbError(error, {
      notFound: APPOINTMENT_NOT_FOUND_MESSAGE,
      fallback: UPDATE_APPOINTMENT_ERROR_MESSAGE,
    });
  }

  const row = data as AppointmentRow | null;
  if (!row) {
    throw new ReceptionistServiceError(
      404,
      "NOT_FOUND",
      APPOINTMENT_NOT_FOUND_MESSAGE,
    );
  }

  return row;
}

function throwBlockedCheckInError(status: AppointmentStatus): never {
  switch (status) {
    case "CANCELLED":
      throw new ReceptionistServiceError(
        409,
        "INVALID_STATUS_TRANSITION",
        "الحجز ده ملغي، ما ينفعش تسجّل وصول المريض.",
      );
    case "CHECKED_IN":
      throw new ReceptionistServiceError(
        409,
        "ALREADY_CHECKED_IN",
        "تم تسجيل وصول المريض بالفعل قبل كده.",
      );
    case "COMPLETED":
      throw new ReceptionistServiceError(
        409,
        "INVALID_STATUS_TRANSITION",
        "الكشف ده خلص بالفعل، ما ينفعش تسجّل وصوله تاني.",
      );
    case "NO_SHOW":
      throw new ReceptionistServiceError(
        409,
        "INVALID_STATUS_TRANSITION",
        "الحجز ده متسجّل إنه ما حضرش، ما ينفعش تسجّل وصوله.",
      );
    default:
      throw new ReceptionistServiceError(
        409,
        "INVALID_STATUS_TRANSITION",
        STALE_STATUS_MESSAGE,
      );
  }
}

/**
 * Checks a patient in (`CONFIRMED` -> `CHECKED_IN`) strictly within the
 * receptionist's assigned clinic, blocking `CANCELLED` and already-settled rows.
 */
export async function checkInReceptionistAppointment(
  adminClient: SupabaseClient<Database>,
  clinicId: string,
  reference: string,
): Promise<ReceptionistAppointment> {
  const existing = await fetchRawAppointmentForClinic(
    adminClient,
    clinicId,
    reference,
  );

  if (existing.status !== "CONFIRMED") {
    throwBlockedCheckInError(existing.status);
  }

  const { data: updatedData, error: updateError } = await adminClient
    .from("appointments")
    .update({ status: "CHECKED_IN" })
    .eq("id", existing.id)
    .eq("clinic_id", clinicId)
    .eq("status", "CONFIRMED")
    .select(APPOINTMENT_SELECT)
    .maybeSingle();

  if (updateError) {
    throw mapReceptionistDbError(updateError, {
      notFound: APPOINTMENT_NOT_FOUND_MESSAGE,
      fallback: UPDATE_APPOINTMENT_ERROR_MESSAGE,
    });
  }

  const updated = updatedData as AppointmentRow | null;
  if (!updated) {
    const latest = await fetchRawAppointmentForClinic(
      adminClient,
      clinicId,
      reference,
    );
    if (latest.status !== "CONFIRMED") {
      throwBlockedCheckInError(latest.status);
    }
    throw new ReceptionistServiceError(
      409,
      "INVALID_STATUS_TRANSITION",
      STALE_STATUS_MESSAGE,
    );
  }

  const [hydrated] = await hydrateAppointmentRows(
    adminClient,
    [updated],
    UPDATE_APPOINTMENT_ERROR_MESSAGE,
  );
  return hydrated;
}

/**
 * Transitions a clinic appointment status (`CONFIRMED` -> `CHECKED_IN`/`NO_SHOW`
 * or `CHECKED_IN` -> `COMPLETED`), blocking `CANCELLED` and invalid jumps.
 */
export async function updateReceptionistAppointmentStatus(
  adminClient: SupabaseClient<Database>,
  clinicId: string,
  reference: string,
  targetStatus: ReceptionistStatusTarget,
): Promise<ReceptionistAppointment> {
  if (targetStatus === "CHECKED_IN") {
    return checkInReceptionistAppointment(adminClient, clinicId, reference);
  }

  const existing = await fetchRawAppointmentForClinic(
    adminClient,
    clinicId,
    reference,
  );

  if (existing.status === "CANCELLED") {
    throw new ReceptionistServiceError(
      409,
      "INVALID_STATUS_TRANSITION",
      "الحجز ده ملغي، ما ينفعش تعدّل حالته.",
    );
  }

  if (existing.status === "COMPLETED") {
    throw new ReceptionistServiceError(
      409,
      "INVALID_STATUS_TRANSITION",
      "الكشف ده خلص بالفعل، ما ينفعش تعدّل حالته.",
    );
  }

  if (existing.status === "NO_SHOW") {
    throw new ReceptionistServiceError(
      409,
      "INVALID_STATUS_TRANSITION",
      "الحجز ده متسجّل إنه ما حضرش، ما ينفعش تعدّل حالته.",
    );
  }

  const isAllowed =
    (existing.status === "CONFIRMED" && targetStatus === "NO_SHOW") ||
    (existing.status === "CHECKED_IN" && targetStatus === "COMPLETED");

  if (!isAllowed) {
    const message =
      existing.status === "CONFIRMED" && targetStatus === "COMPLETED"
        ? "سجّل وصول المريض الأول قبل ما تخلّي الحالة خلص."
        : "ما ينفعش تغيّر حالة الحجز من حالته الحالية للحالة دي.";

    throw new ReceptionistServiceError(
      409,
      "INVALID_STATUS_TRANSITION",
      message,
    );
  }

  const { data: updatedData, error: updateError } = await adminClient
    .from("appointments")
    .update({ status: targetStatus })
    .eq("id", existing.id)
    .eq("clinic_id", clinicId)
    .eq("status", existing.status)
    .select(APPOINTMENT_SELECT)
    .maybeSingle();

  if (updateError) {
    throw mapReceptionistDbError(updateError, {
      notFound: APPOINTMENT_NOT_FOUND_MESSAGE,
      fallback: UPDATE_APPOINTMENT_ERROR_MESSAGE,
    });
  }

  const updated = updatedData as AppointmentRow | null;
  if (!updated) {
    throw new ReceptionistServiceError(
      409,
      "INVALID_STATUS_TRANSITION",
      STALE_STATUS_MESSAGE,
    );
  }

  const [hydrated] = await hydrateAppointmentRows(
    adminClient,
    [updated],
    UPDATE_APPOINTMENT_ERROR_MESSAGE,
  );
  return hydrated;
}

/**
 * Creates the `GET /api/receptionist/appointments` handler with injectable dependencies for tests.
 */
export function createReceptionistAppointmentsGetHandler(
  deps: ReceptionistHandlerDeps = {},
): (request: Request) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleReceptionistAppointmentsGet(
    request: Request,
  ): Promise<Response> {
    try {
      const staff = await requireAdmin(["RECEPTIONIST"]);
      const clinicId = assertReceptionistClinic(staff);

      const parsed = parseReceptionistAppointmentsFilter(
        new URL(request.url).searchParams,
      );
      if (!parsed.success) {
        throw new ReceptionistServiceError(
          400,
          "VALIDATION_ERROR",
          parsed.message,
          { fieldErrors: parsed.fieldErrors },
        );
      }

      if (parsed.data.clinicId) {
        assertClinicAccess(staff, parsed.data.clinicId);
      }

      const appointments = await listReceptionistAppointments(
        getAdminClient(),
        clinicId,
        parsed.data,
      );
      return receptionistJson({ appointments }, { status: 200 });
    } catch (error) {
      return toReceptionistErrorResponse(error);
    }
  };
}

/**
 * Creates the `GET /api/receptionist/appointments/lookup` handler for QR or reference lookup.
 */
export function createReceptionistAppointmentLookupGetHandler(
  deps: ReceptionistHandlerDeps = {},
): (request: Request) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleReceptionistAppointmentLookupGet(
    request: Request,
  ): Promise<Response> {
    try {
      const staff = await requireAdmin(["RECEPTIONIST"]);
      const clinicId = assertReceptionistClinic(staff);

      const parsed = parseReceptionistLookupQuery(
        new URL(request.url).searchParams,
      );
      if (!parsed.success) {
        throw new ReceptionistServiceError(
          400,
          "VALIDATION_ERROR",
          parsed.message,
          { fieldErrors: parsed.fieldErrors },
        );
      }

      const adminClient = getAdminClient();
      const appointment =
        parsed.data.type === "reference"
          ? await getReceptionistAppointmentByReference(
              adminClient,
              clinicId,
              parsed.data.reference,
            )
          : await getReceptionistAppointmentByQrToken(
              adminClient,
              clinicId,
              parsed.data.qrToken,
            );

      return receptionistJson({ appointment }, { status: 200 });
    } catch (error) {
      return toReceptionistErrorResponse(error);
    }
  };
}

/**
 * Creates the `GET /api/receptionist/appointments/[reference]` handler.
 */
export function createReceptionistAppointmentByReferenceGetHandler(
  deps: ReceptionistHandlerDeps = {},
): (
  request: Request,
  context: { params: Promise<{ reference: string }> },
) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleReceptionistAppointmentByReferenceGet(
    _request: Request,
    context: { params: Promise<{ reference: string }> },
  ): Promise<Response> {
    try {
      const staff = await requireAdmin(["RECEPTIONIST"]);
      const clinicId = assertReceptionistClinic(staff);

      const { reference: rawReference } = await context.params;
      const parsed = parseReceptionistReferenceParam(rawReference);
      if (!parsed.success) {
        throw new ReceptionistServiceError(
          400,
          "VALIDATION_ERROR",
          parsed.message,
          { fieldErrors: { reference: parsed.message } },
        );
      }

      const appointment = await getReceptionistAppointmentByReference(
        getAdminClient(),
        clinicId,
        parsed.reference,
      );

      return receptionistJson({ appointment }, { status: 200 });
    } catch (error) {
      return toReceptionistErrorResponse(error);
    }
  };
}

/**
 * Creates the `POST /api/receptionist/appointments/[reference]/check-in` handler.
 */
export function createReceptionistAppointmentCheckInPostHandler(
  deps: ReceptionistHandlerDeps = {},
): (
  request: Request,
  context: { params: Promise<{ reference: string }> },
) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleReceptionistAppointmentCheckInPost(
    _request: Request,
    context: { params: Promise<{ reference: string }> },
  ): Promise<Response> {
    try {
      const staff = await requireAdmin(["RECEPTIONIST"]);
      const clinicId = assertReceptionistClinic(staff);

      const { reference: rawReference } = await context.params;
      const parsed = parseReceptionistReferenceParam(rawReference);
      if (!parsed.success) {
        throw new ReceptionistServiceError(
          400,
          "VALIDATION_ERROR",
          parsed.message,
          { fieldErrors: { reference: parsed.message } },
        );
      }

      const appointment = await checkInReceptionistAppointment(
        getAdminClient(),
        clinicId,
        parsed.reference,
      );

      return receptionistJson({ appointment }, { status: 200 });
    } catch (error) {
      return toReceptionistErrorResponse(error);
    }
  };
}

/**
 * Creates the `PATCH /api/receptionist/appointments/[reference]/status` handler.
 */
export function createReceptionistAppointmentStatusPatchHandler(
  deps: ReceptionistHandlerDeps = {},
): (
  request: Request,
  context: { params: Promise<{ reference: string }> },
) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleReceptionistAppointmentStatusPatch(
    request: Request,
    context: { params: Promise<{ reference: string }> },
  ): Promise<Response> {
    try {
      const staff = await requireAdmin(["RECEPTIONIST"]);
      const clinicId = assertReceptionistClinic(staff);

      const { reference: rawReference } = await context.params;
      const parsedRef = parseReceptionistReferenceParam(rawReference);
      if (!parsedRef.success) {
        throw new ReceptionistServiceError(
          400,
          "VALIDATION_ERROR",
          parsedRef.message,
          { fieldErrors: { reference: parsedRef.message } },
        );
      }

      const body = await parseReceptionistJsonBody(request);
      const parsedStatus = parseReceptionistStatusUpdateInput(body);
      if (!parsedStatus.success) {
        throw new ReceptionistServiceError(
          400,
          "VALIDATION_ERROR",
          parsedStatus.message,
          { fieldErrors: parsedStatus.fieldErrors },
        );
      }

      const appointment = await updateReceptionistAppointmentStatus(
        getAdminClient(),
        clinicId,
        parsedRef.reference,
        parsedStatus.data.status,
      );

      return receptionistJson({ appointment }, { status: 200 });
    } catch (error) {
      return toReceptionistErrorResponse(error);
    }
  };
}
