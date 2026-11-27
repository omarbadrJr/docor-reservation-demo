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
  parseCreateDoctorInput,
  parseUpdateDoctorInput,
  parseUuidParam,
  validateDoctorPhotoFile,
} from "@/lib/validations/owner";
import { OwnerServiceError, mapOwnerDbError } from "@/services/owner-errors";
import type { StaffProfile } from "@/types/auth";
import type { AdminRole, Database, Doctor } from "@/types/database";
import type {
  CreateDoctorInput,
  OwnerDoctor,
  UpdateDoctorInput,
} from "@/types/owner";

const DOCTOR_PHOTOS_BUCKET = "doctor-photos";
const MAX_DOCTOR_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const DOCTORS_LOAD_ERROR = "مقدرناش نحمّل قائمة الدكاترة دلوقتي، حاول تاني.";
const DOCTOR_NOT_FOUND_ERROR = "الدكتور المطلوب مش موجود.";
const CLINIC_MISSING_ERROR = "العيادة المختارة مش موجودة.";
const SPECIALTY_MISSING_ERROR = "التخصص المختار مش موجود.";
const DOCTOR_REFERENCES_LOAD_ERROR =
  "مقدرناش نتحقق من بيانات العيادة والتخصص دلوقتي، حاول تاني.";
const DOCTOR_CREATE_ERROR = "مقدرناش نضيف الدكتور دلوقتي، حاول تاني.";
const DOCTOR_UPDATE_ERROR = "مقدرناش نحدّث بيانات الدكتور دلوقتي، حاول تاني.";
const PHOTO_UPLOAD_ERROR = "مقدرناش نرفع صورة الدكتور دلوقتي، حاول تاني.";
const PHOTO_MISSING_ERROR = "اختار صورة للدكتور الأول.";
const PHOTO_FORM_ERROR = "بيانات رفع الصورة مش مظبوطة، حاول تاني.";

export type OwnerDoctorsClient = SupabaseClient<Database>;

export interface OwnerDoctorFormOption {
  id: string;
  name: string;
  isActive: boolean;
}

export interface OwnerDoctorFormOptions {
  clinics: OwnerDoctorFormOption[];
  specialties: OwnerDoctorFormOption[];
}

export interface ListOwnerDoctorsFilters {
  clinicId?: string;
  specialtyId?: string;
  includeInactive?: boolean;
}

export interface OwnerDoctorsRouteDeps {
  requireAdmin?: (allowedRoles?: readonly AdminRole[]) => Promise<StaffProfile>;
  getAdminClient?: () => OwnerDoctorsClient;
}

interface ClinicRefRow {
  id: string;
  name: string;
  is_active: boolean;
}

interface SpecialtyRefRow {
  id: string;
  name: string;
  is_active: boolean;
}

function mapDoctorRow(
  row: Doctor,
  clinic: ClinicRefRow | undefined,
  specialty: SpecialtyRefRow | undefined,
): OwnerDoctor {
  return {
    id: row.id,
    fullName: row.full_name,
    clinicId: row.clinic_id,
    clinicName: clinic?.name ?? "",
    clinicIsActive: clinic?.is_active ?? false,
    specialtyId: row.specialty_id,
    specialtyName: specialty?.name ?? "",
    specialtyIsActive: specialty?.is_active ?? false,
    photoUrl: row.photo_url,
    bio: row.bio,
    qualifications: row.qualifications,
    experienceYears: row.experience_years,
    consultationFee: String(row.consultation_fee),
    slotDurationMinutes: row.slot_duration_minutes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function hydrateOwnerDoctors(
  adminClient: OwnerDoctorsClient,
  rows: Doctor[],
): Promise<OwnerDoctor[]> {
  if (rows.length === 0) {
    return [];
  }

  const clinicIds = [...new Set(rows.map((row) => row.clinic_id))];
  const specialtyIds = [...new Set(rows.map((row) => row.specialty_id))];

  const [clinicsResult, specialtiesResult] = await Promise.all([
    adminClient
      .from("clinics")
      .select("id, name, is_active")
      .in("id", clinicIds),
    adminClient
      .from("specialties")
      .select("id, name, is_active")
      .in("id", specialtyIds),
  ]);

  if (clinicsResult.error) {
    throw mapOwnerDbError(clinicsResult.error, {
      fallback: DOCTORS_LOAD_ERROR,
    });
  }

  if (specialtiesResult.error) {
    throw mapOwnerDbError(specialtiesResult.error, {
      fallback: DOCTORS_LOAD_ERROR,
    });
  }

  const clinicMap = new Map(
    (clinicsResult.data ?? []).map((clinic) => [clinic.id, clinic]),
  );
  const specialtyMap = new Map(
    (specialtiesResult.data ?? []).map((specialty) => [
      specialty.id,
      specialty,
    ]),
  );

  return rows.map((row) =>
    mapDoctorRow(
      row,
      clinicMap.get(row.clinic_id),
      specialtyMap.get(row.specialty_id),
    ),
  );
}

async function assertDoctorReferencesExist(
  adminClient: OwnerDoctorsClient,
  refs: { clinicId?: string; specialtyId?: string },
): Promise<void> {
  const [clinicResult, specialtyResult] = await Promise.all([
    refs.clinicId !== undefined
      ? adminClient
          .from("clinics")
          .select("id")
          .eq("id", refs.clinicId)
          .maybeSingle()
      : Promise.resolve(null),
    refs.specialtyId !== undefined
      ? adminClient
          .from("specialties")
          .select("id")
          .eq("id", refs.specialtyId)
          .maybeSingle()
      : Promise.resolve(null),
  ]);

  if (clinicResult?.error) {
    throw mapOwnerDbError(clinicResult.error, {
      fallback: DOCTOR_REFERENCES_LOAD_ERROR,
    });
  }

  if (specialtyResult?.error) {
    throw mapOwnerDbError(specialtyResult.error, {
      fallback: DOCTOR_REFERENCES_LOAD_ERROR,
    });
  }

  const fieldErrors: Record<string, string> = {};

  if (refs.clinicId !== undefined && !clinicResult?.data) {
    fieldErrors.clinicId = CLINIC_MISSING_ERROR;
  }

  if (refs.specialtyId !== undefined && !specialtyResult?.data) {
    fieldErrors.specialtyId = SPECIALTY_MISSING_ERROR;
  }

  const messages = Object.values(fieldErrors);
  if (messages.length > 0) {
    throw new OwnerServiceError(
      400,
      "VALIDATION_ERROR",
      messages.length === 1
        ? messages[0]
        : "العيادة أو التخصص المختار مش موجود.",
      { fieldErrors },
    );
  }
}

/**
 * Lists owner-visible doctors ordered by `full_name` with hydrated clinic and specialty metadata.
 */
export async function listOwnerDoctors(
  adminClient: OwnerDoctorsClient,
  filters?: ListOwnerDoctorsFilters,
): Promise<OwnerDoctor[]> {
  let query = adminClient.from("doctors").select("*");

  if (filters?.clinicId) {
    query = query.eq("clinic_id", filters.clinicId);
  }

  if (filters?.specialtyId) {
    query = query.eq("specialty_id", filters.specialtyId);
  }

  if (filters?.includeInactive === false) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query.order("full_name");

  if (error) {
    throw mapOwnerDbError(error, { fallback: DOCTORS_LOAD_ERROR });
  }

  return hydrateOwnerDoctors(adminClient, data ?? []);
}

/**
 * Loads lightweight clinic and specialty options directly for the doctor form and filters.
 */
export async function listOwnerDoctorFormOptions(
  adminClient: OwnerDoctorsClient,
): Promise<OwnerDoctorFormOptions> {
  const [clinicsResult, specialtiesResult] = await Promise.all([
    adminClient
      .from("clinics")
      .select("id, name, is_active")
      .order("name"),
    adminClient
      .from("specialties")
      .select("id, name, is_active")
      .order("name"),
  ]);

  if (clinicsResult.error) {
    throw mapOwnerDbError(clinicsResult.error, {
      fallback: DOCTORS_LOAD_ERROR,
    });
  }

  if (specialtiesResult.error) {
    throw mapOwnerDbError(specialtiesResult.error, {
      fallback: DOCTORS_LOAD_ERROR,
    });
  }

  return {
    clinics: (clinicsResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      isActive: row.is_active,
    })),
    specialties: (specialtiesResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      isActive: row.is_active,
    })),
  };
}

/**
 * Fetches one doctor by ID with hydrated clinic and specialty metadata or throws 404.
 */
export async function getOwnerDoctorById(
  adminClient: OwnerDoctorsClient,
  id: string,
): Promise<OwnerDoctor> {
  const { data, error } = await adminClient
    .from("doctors")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw mapOwnerDbError(error, {
      notFound: DOCTOR_NOT_FOUND_ERROR,
      fallback: DOCTORS_LOAD_ERROR,
    });
  }

  if (!data) {
    throw new OwnerServiceError(404, "NOT_FOUND", DOCTOR_NOT_FOUND_ERROR);
  }

  const [hydrated] = await hydrateOwnerDoctors(adminClient, [data]);
  return hydrated;
}

/**
 * Creates a doctor linked to one clinic and one primary specialty and returns the hydrated record.
 */
export async function createOwnerDoctor(
  adminClient: OwnerDoctorsClient,
  input: CreateDoctorInput,
): Promise<OwnerDoctor> {
  await assertDoctorReferencesExist(adminClient, {
    clinicId: input.clinicId,
    specialtyId: input.specialtyId,
  });

  const { data, error } = await adminClient
    .from("doctors")
    .insert({
      full_name: input.fullName,
      clinic_id: input.clinicId,
      specialty_id: input.specialtyId,
      bio: input.bio,
      qualifications: input.qualifications,
      experience_years: input.experienceYears,
      consultation_fee: input.consultationFee,
      slot_duration_minutes: input.slotDurationMinutes,
      photo_url: input.photoUrl,
      is_active: input.isActive,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw mapOwnerDbError(error, {
      invalidReference: "العيادة أو التخصص المختار مش موجود.",
      fallback: DOCTOR_CREATE_ERROR,
    });
  }

  const [hydrated] = await hydrateOwnerDoctors(adminClient, [data]);
  return hydrated;
}

/**
 * Updates an existing doctor by ID (including status toggles) and returns the hydrated record.
 */
export async function updateOwnerDoctor(
  adminClient: OwnerDoctorsClient,
  id: string,
  input: UpdateDoctorInput,
): Promise<OwnerDoctor> {
  const updatePayload: Database["public"]["Tables"]["doctors"]["Update"] = {};
  if (input.fullName !== undefined) {
    updatePayload.full_name = input.fullName;
  }
  if (input.clinicId !== undefined) {
    updatePayload.clinic_id = input.clinicId;
  }
  if (input.specialtyId !== undefined) {
    updatePayload.specialty_id = input.specialtyId;
  }
  if (input.bio !== undefined) {
    updatePayload.bio = input.bio;
  }
  if (input.qualifications !== undefined) {
    updatePayload.qualifications = input.qualifications;
  }
  if (input.experienceYears !== undefined) {
    updatePayload.experience_years = input.experienceYears;
  }
  if (input.consultationFee !== undefined) {
    updatePayload.consultation_fee = input.consultationFee;
  }
  if (input.slotDurationMinutes !== undefined) {
    updatePayload.slot_duration_minutes = input.slotDurationMinutes;
  }
  if (input.photoUrl !== undefined) {
    updatePayload.photo_url = input.photoUrl;
  }
  if (input.isActive !== undefined) {
    updatePayload.is_active = input.isActive;
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new OwnerServiceError(
      400,
      "VALIDATION_ERROR",
      "لازم تبعت بيان واحد على الأقل للتعديل.",
    );
  }

  const { data: existing, error: existingError } = await adminClient
    .from("doctors")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    throw mapOwnerDbError(existingError, {
      notFound: DOCTOR_NOT_FOUND_ERROR,
      fallback: DOCTOR_UPDATE_ERROR,
    });
  }

  if (!existing) {
    throw new OwnerServiceError(404, "NOT_FOUND", DOCTOR_NOT_FOUND_ERROR);
  }

  if (input.clinicId !== undefined || input.specialtyId !== undefined) {
    await assertDoctorReferencesExist(adminClient, {
      clinicId: input.clinicId,
      specialtyId: input.specialtyId,
    });
  }

  const { data, error } = await adminClient
    .from("doctors")
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    throw mapOwnerDbError(error, {
      notFound: DOCTOR_NOT_FOUND_ERROR,
      invalidReference: "العيادة أو التخصص المختار مش موجود.",
      fallback: DOCTOR_UPDATE_ERROR,
    });
  }

  if (!data) {
    throw new OwnerServiceError(404, "NOT_FOUND", DOCTOR_NOT_FOUND_ERROR);
  }

  const [hydrated] = await hydrateOwnerDoctors(adminClient, [data]);
  return hydrated;
}

/**
 * Validates a doctor photo file by MIME, size, and magic header, then uploads it to Supabase Storage.
 */
export async function uploadDoctorPhoto(
  adminClient: OwnerDoctorsClient,
  file: File,
): Promise<{ photoUrl: string }> {
  const mimeType =
    typeof file.type === "string" ? file.type.trim().toLowerCase() : "";
  if (!ALLOWED_PHOTO_MIME_TYPES.has(mimeType)) {
    const message = "نوع الصورة مش مدعوم. ارفع صورة JPG أو PNG أو WebP.";
    throw new OwnerServiceError(400, "VALIDATION_ERROR", message, {
      fieldErrors: { file: message },
    });
  }

  if (!Number.isFinite(file.size) || file.size < 1) {
    const message = "ملف الصورة فاضي، اختار صورة تانية.";
    throw new OwnerServiceError(400, "VALIDATION_ERROR", message, {
      fieldErrors: { file: message },
    });
  }

  if (file.size > MAX_DOCTOR_PHOTO_BYTES) {
    const message = "حجم الصورة كبير أوي، أقصى حجم مسموح بيه 5 ميجا.";
    throw new OwnerServiceError(400, "VALIDATION_ERROR", message, {
      fieldErrors: { file: message },
    });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateDoctorPhotoFile(
    { type: file.type, size: file.size },
    bytes,
  );

  if (!validation.success) {
    throw new OwnerServiceError(400, "VALIDATION_ERROR", validation.message, {
      fieldErrors: { file: validation.message },
    });
  }

  const objectPath = `doctors/${crypto.randomUUID()}.${validation.extension}`;
  const storage = adminClient.storage.from(DOCTOR_PHOTOS_BUCKET);

  const { error: uploadError } = await storage.upload(objectPath, bytes, {
    contentType: validation.contentType,
    upsert: false,
  });

  if (uploadError) {
    throw new OwnerServiceError(500, "INTERNAL_ERROR", PHOTO_UPLOAD_ERROR);
  }

  const { data: publicUrlData } = storage.getPublicUrl(objectPath);
  const publicUrl = publicUrlData?.publicUrl;

  if (!publicUrl) {
    throw new OwnerServiceError(500, "INTERNAL_ERROR", PHOTO_UPLOAD_ERROR);
  }

  return { photoUrl: publicUrl };
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

function parseListDoctorsFilters(
  searchParams: URLSearchParams,
): ListOwnerDoctorsFilters {
  const filters: ListOwnerDoctorsFilters = {};
  const fieldErrors: Record<string, string> = {};

  const clinicParam = readSingleQueryParam(searchParams, "clinicId");
  if (!clinicParam.ok) {
    fieldErrors.clinicId = "اختار عيادة واحدة بس في البحث.";
  } else if (clinicParam.value !== undefined) {
    const parsedClinic = parseUuidParam(clinicParam.value, "العيادة");
    if (!parsedClinic.success) {
      fieldErrors.clinicId = parsedClinic.message;
    } else {
      filters.clinicId = parsedClinic.id;
    }
  }

  const specialtyParam = readSingleQueryParam(searchParams, "specialtyId");
  if (!specialtyParam.ok) {
    fieldErrors.specialtyId = "اختار تخصص واحد بس في البحث.";
  } else if (specialtyParam.value !== undefined) {
    const parsedSpecialty = parseUuidParam(specialtyParam.value, "التخصص");
    if (!parsedSpecialty.success) {
      fieldErrors.specialtyId = parsedSpecialty.message;
    } else {
      filters.specialtyId = parsedSpecialty.id;
    }
  }

  const includeInactiveParam = readSingleQueryParam(
    searchParams,
    "includeInactive",
  );
  if (!includeInactiveParam.ok) {
    fieldErrors.includeInactive = "حدد قيمة واحدة بس لعرض الدكاترة غير النشطين.";
  } else if (includeInactiveParam.value !== undefined) {
    const normalized = includeInactiveParam.value.toLowerCase();
    if (normalized === "true" || normalized === "1") {
      filters.includeInactive = true;
    } else if (normalized === "false" || normalized === "0") {
      filters.includeInactive = false;
    } else {
      fieldErrors.includeInactive =
        "قيمة عرض الدكاترة غير النشطين مش صحيحة.";
    }
  }

  const messages = Object.values(fieldErrors);
  if (messages.length > 0) {
    throw new OwnerServiceError(
      400,
      "VALIDATION_ERROR",
      messages.length === 1
        ? messages[0]
        : "بيانات البحث مش مظبوطة، راجعها وحاول تاني.",
      { fieldErrors },
    );
  }

  return filters;
}

/**
 * Creates the `GET /api/owner/doctors` handler with injectable dependencies for tests.
 */
export function createOwnerDoctorsGetHandler(
  deps: OwnerDoctorsRouteDeps = {},
): (request: Request) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleOwnerDoctorsGet(
    request: Request,
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const filters = parseListDoctorsFilters(new URL(request.url).searchParams);
      const doctors = await listOwnerDoctors(getAdminClient(), filters);
      return ownerJson({ doctors }, { status: 200 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}

/**
 * Creates the `POST /api/owner/doctors` handler with injectable dependencies for tests.
 */
export function createOwnerDoctorsPostHandler(
  deps: OwnerDoctorsRouteDeps = {},
): (request: Request) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleOwnerDoctorsPost(
    request: Request,
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const body = await parseJsonBody(request);
      const parsed = parseCreateDoctorInput(body);
      if (!parsed.success) {
        throw new OwnerServiceError(400, "VALIDATION_ERROR", parsed.message, {
          fieldErrors: parsed.fieldErrors,
        });
      }

      const doctor = await createOwnerDoctor(getAdminClient(), parsed.data);
      return ownerJson({ doctor }, { status: 201 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}

/**
 * Creates the `GET /api/owner/doctors/[id]` handler with injectable dependencies for tests.
 */
export function createOwnerDoctorByIdGetHandler(
  deps: OwnerDoctorsRouteDeps = {},
): (_request: Request, id: string) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleOwnerDoctorByIdGet(
    _request: Request,
    rawId: string,
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const id = requireUuidOrThrow(rawId, "الدكتور");
      const doctor = await getOwnerDoctorById(getAdminClient(), id);
      return ownerJson({ doctor }, { status: 200 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}

/**
 * Creates the `PATCH /api/owner/doctors/[id]` handler with injectable dependencies for tests.
 */
export function createOwnerDoctorByIdPatchHandler(
  deps: OwnerDoctorsRouteDeps = {},
): (request: Request, id: string) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleOwnerDoctorByIdPatch(
    request: Request,
    rawId: string,
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const id = requireUuidOrThrow(rawId, "الدكتور");
      const body = await parseJsonBody(request);
      const parsed = parseUpdateDoctorInput(body);
      if (!parsed.success) {
        throw new OwnerServiceError(400, "VALIDATION_ERROR", parsed.message, {
          fieldErrors: parsed.fieldErrors,
        });
      }

      const doctor = await updateOwnerDoctor(getAdminClient(), id, parsed.data);
      return ownerJson({ doctor }, { status: 200 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}

/**
 * Creates the `POST /api/owner/doctors/photo` handler with injectable dependencies for tests.
 */
export function createOwnerDoctorPhotoPostHandler(
  deps: OwnerDoctorsRouteDeps = {},
): (request: Request) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleOwnerDoctorPhotoPost(
    request: Request,
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);

      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        throw new OwnerServiceError(400, "VALIDATION_ERROR", PHOTO_FORM_ERROR);
      }

      const fileEntry = formData.get("file");
      if (!(fileEntry instanceof File)) {
        throw new OwnerServiceError(
          400,
          "VALIDATION_ERROR",
          PHOTO_MISSING_ERROR,
          { fieldErrors: { file: PHOTO_MISSING_ERROR } },
        );
      }

      const result = await uploadDoctorPhoto(getAdminClient(), fileEntry);
      return ownerJson(result, { status: 201 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}
