import type { SupabaseClient } from "@supabase/supabase-js";

import { ownerJson, toOwnerErrorResponse } from "@/app/api/owner/_shared";
import { requireAdminApi } from "@/lib/auth/guards";
import { getCairoNow, type CairoNow } from "@/lib/cairo-time";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseOwnerAppointmentsFilter } from "@/lib/validations/owner";
import { mapOwnerDbError, OwnerServiceError } from "@/services/owner-errors";
import type { StaffProfile } from "@/types/auth";
import type {
  AdminRole,
  AppointmentStatus,
  Database,
} from "@/types/database";
import type {
  OwnerAppointment,
  OwnerAppointmentsFilter,
  OwnerDashboardOverview,
} from "@/types/owner";

const OVERVIEW_APPOINTMENTS_LIMIT = 10;

const APPOINTMENT_SELECT =
  "id, reference_number, doctor_id, clinic_id, patient_name, patient_phone, appointment_date, start_time, end_time, status, created_at";

const ACTIVE_TODAY_STATUSES: readonly AppointmentStatus[] = [
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "NO_SHOW",
];

const UPCOMING_STATUSES: readonly AppointmentStatus[] = [
  "CONFIRMED",
  "CHECKED_IN",
];

const UNKNOWN_DOCTOR_NAME = "دكتور غير معروف";
const UNKNOWN_CLINIC_NAME = "عيادة غير معروفة";
const UNKNOWN_SPECIALTY_NAME = "تخصص غير معروف";

const LOAD_APPOINTMENTS_ERROR_MESSAGE =
  "حصلت مشكلة وإحنا بنحمّل الحجوزات، حاول تاني بعد شوية.";
const LOAD_FILTER_OPTIONS_ERROR_MESSAGE =
  "حصلت مشكلة وإحنا بنحمّل خيارات الفلترة، حاول تاني بعد شوية.";
const LOAD_OVERVIEW_ERROR_MESSAGE =
  "حصلت مشكلة وإحنا بنحمّل ملخص لوحة التحكم، حاول تاني بعد شوية.";

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
  is_active: boolean;
};

type SpecialtyLookupRow = {
  id: string;
  name: string;
};

type ClinicCountRow = {
  id: string;
  name: string;
  is_active: boolean;
};

type SpecialtyCountRow = {
  id: string;
  name: string;
  is_active: boolean;
};

type ReceptionistCountRow = {
  id: string;
  is_active: boolean;
};

type DoctorFilterRow = {
  id: string;
  full_name: string;
  clinic_id: string;
  is_active: boolean;
};

export interface OwnerAppointmentClinicOption {
  id: string;
  name: string;
  isActive: boolean;
}

export interface OwnerAppointmentDoctorOption {
  id: string;
  fullName: string;
  clinicId: string;
  isActive: boolean;
}

export interface OwnerAppointmentFilterOptions {
  clinics: OwnerAppointmentClinicOption[];
  doctors: OwnerAppointmentDoctorOption[];
}

export interface OwnerOverviewGetHandlerDeps {
  requireAdmin?: (allowedRoles?: readonly AdminRole[]) => Promise<StaffProfile>;
  getAdminClient?: () => SupabaseClient<Database>;
  getNow?: () => CairoNow;
}

export interface OwnerAppointmentsGetHandlerDeps {
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

function hydrateAppointmentRows(
  rows: readonly AppointmentRow[],
  doctorsById: ReadonlyMap<string, DoctorLookupRow>,
  clinicsById: ReadonlyMap<string, ClinicLookupRow>,
  specialtiesById: ReadonlyMap<string, SpecialtyLookupRow>,
): OwnerAppointment[] {
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
      clinicId: row.clinic_id,
      clinicName: clinic?.name ?? UNKNOWN_CLINIC_NAME,
      clinicIsActive: clinic?.is_active ?? false,
      specialtyName: specialty?.name ?? UNKNOWN_SPECIALTY_NAME,
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

function compareAppointmentsListOrder(
  first: OwnerAppointment,
  second: OwnerAppointment,
): number {
  return (
    second.appointmentDate.localeCompare(first.appointmentDate) ||
    first.startTime.localeCompare(second.startTime) ||
    second.createdAt.localeCompare(first.createdAt)
  );
}

function compareOverviewTodayOrder(
  first: AppointmentRow,
  second: AppointmentRow,
): number {
  return (
    trimTime(first.start_time).localeCompare(trimTime(second.start_time)) ||
    first.created_at.localeCompare(second.created_at)
  );
}

function compareOverviewUpcomingOrder(
  first: AppointmentRow,
  second: AppointmentRow,
): number {
  return (
    first.appointment_date.localeCompare(second.appointment_date) ||
    trimTime(first.start_time).localeCompare(trimTime(second.start_time)) ||
    first.created_at.localeCompare(second.created_at)
  );
}

/**
 * Lists appointments across all clinics for the owner dashboard, preserving
 * historical bookings for deactivated doctors and clinics.
 */
export async function listOwnerAppointments(
  adminClient: SupabaseClient<Database>,
  filter: OwnerAppointmentsFilter = {},
): Promise<OwnerAppointment[]> {
  let query = adminClient.from("appointments").select(APPOINTMENT_SELECT);

  if (filter.clinicId) {
    query = query.eq("clinic_id", filter.clinicId);
  }
  if (filter.doctorId) {
    query = query.eq("doctor_id", filter.doctorId);
  }
  if (filter.status) {
    query = query.eq("status", filter.status);
  }
  if (filter.date) {
    query = query.eq("appointment_date", filter.date);
  }
  if (filter.dateFrom) {
    query = query.gte("appointment_date", filter.dateFrom);
  }
  if (filter.dateTo) {
    query = query.lte("appointment_date", filter.dateTo);
  }

  const { data: appointmentData, error: appointmentsError } = await query
    .order("appointment_date", { ascending: false })
    .order("start_time", { ascending: true });

  if (appointmentsError) {
    throw mapOwnerDbError(appointmentsError, {
      fallback: LOAD_APPOINTMENTS_ERROR_MESSAGE,
    });
  }

  const rows = (appointmentData ?? []) as AppointmentRow[];
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
    adminClient
      .from("clinics")
      .select("id, name, is_active")
      .in("id", clinicIds),
  ]);

  if (doctorsResult.error) {
    throw mapOwnerDbError(doctorsResult.error, {
      fallback: LOAD_APPOINTMENTS_ERROR_MESSAGE,
    });
  }

  if (clinicsResult.error) {
    throw mapOwnerDbError(clinicsResult.error, {
      fallback: LOAD_APPOINTMENTS_ERROR_MESSAGE,
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
      throw mapOwnerDbError(specialtiesResult.error, {
        fallback: LOAD_APPOINTMENTS_ERROR_MESSAGE,
      });
    }

    specialtyRows = (specialtiesResult.data ?? []) as SpecialtyLookupRow[];
  }

  const doctorsById = new Map(doctorRows.map((doctor) => [doctor.id, doctor]));
  const clinicsById = new Map(clinicRows.map((clinic) => [clinic.id, clinic]));
  const specialtiesById = new Map(
    specialtyRows.map((specialty) => [specialty.id, specialty]),
  );

  let hydrated = hydrateAppointmentRows(
    rows,
    doctorsById,
    clinicsById,
    specialtiesById,
  );

  if (filter.query) {
    const normalizedQuery = normalizeSearchText(filter.query);
    if (normalizedQuery.length > 0) {
      hydrated = hydrated.filter((appointment) => {
        const searchableFields = [
          appointment.referenceNumber,
          appointment.patientName,
          appointment.patientPhone,
          appointment.doctorName,
          appointment.clinicName,
        ];

        return searchableFields.some((field) =>
          normalizeSearchText(field).includes(normalizedQuery),
        );
      });
    }
  }

  return hydrated.sort(compareAppointmentsListOrder);
}

/**
 * Loads all clinics and doctors (including inactive records) for owner
 * appointment filter controls.
 */
export async function listOwnerAppointmentFilterOptions(
  adminClient: SupabaseClient<Database>,
): Promise<OwnerAppointmentFilterOptions> {
  const [clinicsResult, doctorsResult] = await Promise.all([
    adminClient
      .from("clinics")
      .select("id, name, is_active")
      .order("name", { ascending: true }),
    adminClient
      .from("doctors")
      .select("id, full_name, clinic_id, is_active")
      .order("full_name", { ascending: true }),
  ]);

  if (clinicsResult.error) {
    throw mapOwnerDbError(clinicsResult.error, {
      fallback: LOAD_FILTER_OPTIONS_ERROR_MESSAGE,
    });
  }

  if (doctorsResult.error) {
    throw mapOwnerDbError(doctorsResult.error, {
      fallback: LOAD_FILTER_OPTIONS_ERROR_MESSAGE,
    });
  }

  const clinics = ((clinicsResult.data ?? []) as ClinicLookupRow[])
    .map((clinic) => ({
      id: clinic.id,
      name: clinic.name,
      isActive: clinic.is_active,
    }))
    .sort((first, second) => first.name.localeCompare(second.name, "ar"));

  const doctors = ((doctorsResult.data ?? []) as DoctorFilterRow[])
    .map((doctor) => ({
      id: doctor.id,
      fullName: doctor.full_name,
      clinicId: doctor.clinic_id,
      isActive: doctor.is_active,
    }))
    .sort((first, second) =>
      first.fullName.localeCompare(second.fullName, "ar"),
    );

  return { clinics, doctors };
}

/**
 * Computes platform-wide summary counts and today's/upcoming appointment lists
 * anchored to `Africa/Cairo` local date.
 */
export async function getOwnerDashboardOverview(
  adminClient: SupabaseClient<Database>,
  now: CairoNow = getCairoNow(),
): Promise<OwnerDashboardOverview> {
  const todayDate = now.date;

  const [
    clinicsResult,
    specialtiesResult,
    doctorsResult,
    receptionistsResult,
    appointmentsResult,
  ] = await Promise.all([
    adminClient.from("clinics").select("id, name, is_active"),
    adminClient.from("specialties").select("id, name, is_active"),
    adminClient.from("doctors").select("id, full_name, specialty_id, is_active"),
    adminClient
      .from("admin_profiles")
      .select("id, is_active")
      .eq("role", "RECEPTIONIST"),
    adminClient
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .gte("appointment_date", todayDate)
      .in("status", [...ACTIVE_TODAY_STATUSES]),
  ]);

  for (const result of [
    clinicsResult,
    specialtiesResult,
    doctorsResult,
    receptionistsResult,
    appointmentsResult,
  ]) {
    if (result.error) {
      throw mapOwnerDbError(result.error, {
        fallback: LOAD_OVERVIEW_ERROR_MESSAGE,
      });
    }
  }

  const clinicRows = (clinicsResult.data ?? []) as ClinicCountRow[];
  const specialtyRows = (specialtiesResult.data ?? []) as SpecialtyCountRow[];
  const doctorRows = (doctorsResult.data ?? []) as DoctorLookupRow[];
  const receptionistRows =
    (receptionistsResult.data ?? []) as ReceptionistCountRow[];
  const appointmentRows = (appointmentsResult.data ?? []) as AppointmentRow[];

  const todayRows = appointmentRows
    .filter(
      (row) => row.appointment_date === todayDate && row.status !== "CANCELLED",
    )
    .sort(compareOverviewTodayOrder);

  const upcomingRows = appointmentRows
    .filter(
      (row) =>
        row.appointment_date > todayDate &&
        (UPCOMING_STATUSES as readonly string[]).includes(row.status),
    )
    .sort(compareOverviewUpcomingOrder);

  const doctorsById = new Map(doctorRows.map((doctor) => [doctor.id, doctor]));
  const clinicsById = new Map(clinicRows.map((clinic) => [clinic.id, clinic]));
  const specialtiesById = new Map(
    specialtyRows.map((specialty) => [specialty.id, specialty]),
  );

  return {
    todayDate,
    counts: {
      clinicsTotal: clinicRows.length,
      clinicsActive: clinicRows.filter((clinic) => clinic.is_active).length,
      specialtiesTotal: specialtyRows.length,
      specialtiesActive: specialtyRows.filter((specialty) => specialty.is_active)
        .length,
      doctorsTotal: doctorRows.length,
      doctorsActive: doctorRows.filter((doctor) => doctor.is_active).length,
      receptionistsTotal: receptionistRows.length,
      receptionistsActive: receptionistRows.filter(
        (receptionist) => receptionist.is_active,
      ).length,
      todayAppointments: todayRows.length,
      upcomingAppointments: upcomingRows.length,
    },
    todayAppointments: hydrateAppointmentRows(
      todayRows.slice(0, OVERVIEW_APPOINTMENTS_LIMIT),
      doctorsById,
      clinicsById,
      specialtiesById,
    ),
    upcomingAppointments: hydrateAppointmentRows(
      upcomingRows.slice(0, OVERVIEW_APPOINTMENTS_LIMIT),
      doctorsById,
      clinicsById,
      specialtiesById,
    ),
  };
}

/**
 * Creates the `GET /api/owner/overview` handler with injectable dependencies for tests.
 */
export function createOwnerOverviewGetHandler(
  deps: OwnerOverviewGetHandlerDeps = {},
): () => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;
  const getNow = deps.getNow ?? (() => getCairoNow());

  return async function handleOwnerOverviewGet(): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const overview = await getOwnerDashboardOverview(
        getAdminClient(),
        getNow(),
      );
      return ownerJson({ overview }, { status: 200 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}

/**
 * Creates the `GET /api/owner/appointments` handler with injectable dependencies for tests.
 */
export function createOwnerAppointmentsGetHandler(
  deps: OwnerAppointmentsGetHandlerDeps = {},
): (request: Request) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleOwnerAppointmentsGet(
    request: Request,
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const parsed = parseOwnerAppointmentsFilter(
        new URL(request.url).searchParams,
      );
      if (!parsed.success) {
        throw new OwnerServiceError(400, "VALIDATION_ERROR", parsed.message, {
          fieldErrors: parsed.fieldErrors,
        });
      }

      const appointments = await listOwnerAppointments(
        getAdminClient(),
        parsed.data,
      );
      return ownerJson({ appointments }, { status: 200 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}
