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
  parseCreateClinicInput,
  parseUpdateClinicInput,
} from "@/lib/validations/owner";
import { mapOwnerDbError, OwnerServiceError } from "@/services/owner-errors";
import type { StaffProfile } from "@/types/auth";
import type { AdminRole, Clinic, Database } from "@/types/database";
import type {
  CreateClinicInput,
  OwnerClinic,
  UpdateClinicInput,
} from "@/types/owner";

const CLINIC_COLUMNS =
  "id, name, address, phone, is_active, created_at, updated_at";

const LIST_CLINICS_ERROR =
  "مش قادرين نجيب قائمة العيادات دلوقتي، حاول تاني بعد شوية.";
const CREATE_CLINIC_ERROR =
  "مش قادرين نضيف العيادة دلوقتي، حاول تاني بعد شوية.";
const UPDATE_CLINIC_ERROR =
  "مش قادرين نعدّل بيانات العيادة دلوقتي، حاول تاني بعد شوية.";
const CLINIC_CONFLICT_ERROR = "العيادة دي موجودة بالفعل.";
const CLINIC_NOT_FOUND_ERROR = "العيادة دي مش موجودة.";
const EMPTY_CLINIC_UPDATE_ERROR = "لازم تبعت بيان واحد على الأقل للتعديل.";

export interface OwnerClinicsRouteDeps {
  requireAdmin?: (allowedRoles?: readonly AdminRole[]) => Promise<StaffProfile>;
  getAdminClient?: () => SupabaseClient<Database>;
}

function mapClinicRow(row: Clinic, doctorCount: number): OwnerClinic {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    isActive: row.is_active,
    doctorCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Lists all clinics (active and inactive) ordered by name along with their assigned doctor count.
 */
export async function listOwnerClinics(
  adminClient: SupabaseClient<Database>,
): Promise<OwnerClinic[]> {
  const [clinicsResult, doctorsResult] = await Promise.all([
    adminClient
      .from("clinics")
      .select(CLINIC_COLUMNS)
      .order("name", { ascending: true }),
    adminClient.from("doctors").select("clinic_id"),
  ]);

  if (clinicsResult.error) {
    throw mapOwnerDbError(clinicsResult.error, {
      fallback: LIST_CLINICS_ERROR,
    });
  }

  if (doctorsResult.error) {
    throw mapOwnerDbError(doctorsResult.error, {
      fallback: LIST_CLINICS_ERROR,
    });
  }

  const doctorCounts = new Map<string, number>();
  for (const doctor of doctorsResult.data ?? []) {
    doctorCounts.set(
      doctor.clinic_id,
      (doctorCounts.get(doctor.clinic_id) ?? 0) + 1,
    );
  }

  return (clinicsResult.data ?? []).map((row) =>
    mapClinicRow(row, doctorCounts.get(row.id) ?? 0),
  );
}

/**
 * Creates a new clinic and returns its hydrated `OwnerClinic` record.
 */
export async function createOwnerClinic(
  adminClient: SupabaseClient<Database>,
  input: CreateClinicInput,
): Promise<OwnerClinic> {
  const { data, error } = await adminClient
    .from("clinics")
    .insert({
      name: input.name,
      address: input.address,
      phone: input.phone,
      is_active: input.isActive,
    })
    .select(CLINIC_COLUMNS)
    .single();

  if (error) {
    throw mapOwnerDbError(error, {
      conflict: CLINIC_CONFLICT_ERROR,
      fallback: CREATE_CLINIC_ERROR,
    });
  }

  if (!data) {
    throw new OwnerServiceError(500, "INTERNAL_ERROR", CREATE_CLINIC_ERROR);
  }

  return mapClinicRow(data, 0);
}

/**
 * Updates an existing clinic by ID and hydrates its assigned doctor count.
 */
export async function updateOwnerClinic(
  adminClient: SupabaseClient<Database>,
  id: string,
  input: UpdateClinicInput,
): Promise<OwnerClinic> {
  const updates: Database["public"]["Tables"]["clinics"]["Update"] = {};

  if (input.name !== undefined) {
    updates.name = input.name;
  }
  if (input.address !== undefined) {
    updates.address = input.address;
  }
  if (input.phone !== undefined) {
    updates.phone = input.phone;
  }
  if (input.isActive !== undefined) {
    updates.is_active = input.isActive;
  }

  if (Object.keys(updates).length === 0) {
    throw new OwnerServiceError(
      400,
      "VALIDATION_ERROR",
      EMPTY_CLINIC_UPDATE_ERROR,
    );
  }

  const { data, error } = await adminClient
    .from("clinics")
    .update(updates)
    .eq("id", id)
    .select(CLINIC_COLUMNS)
    .maybeSingle();

  if (error) {
    throw mapOwnerDbError(error, {
      conflict: CLINIC_CONFLICT_ERROR,
      notFound: CLINIC_NOT_FOUND_ERROR,
      fallback: UPDATE_CLINIC_ERROR,
    });
  }

  if (!data) {
    throw new OwnerServiceError(404, "NOT_FOUND", CLINIC_NOT_FOUND_ERROR);
  }

  const {
    data: doctors,
    count,
    error: countError,
  } = await adminClient
    .from("doctors")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", id);

  if (countError) {
    throw mapOwnerDbError(countError, {
      fallback: UPDATE_CLINIC_ERROR,
    });
  }

  const doctorCount =
    typeof count === "number" ? count : (doctors?.length ?? 0);

  return mapClinicRow(data, doctorCount);
}

/**
 * Creates the `GET /api/owner/clinics` handler with injectable dependencies for tests.
 */
export function createOwnerClinicsGetHandler(
  deps: OwnerClinicsRouteDeps = {},
): () => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleOwnerClinicsGet(): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const clinics = await listOwnerClinics(getAdminClient());
      return ownerJson({ clinics }, { status: 200 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}

/**
 * Creates the `POST /api/owner/clinics` handler with injectable dependencies for tests.
 */
export function createOwnerClinicsPostHandler(
  deps: OwnerClinicsRouteDeps = {},
): (request: Request) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleOwnerClinicsPost(
    request: Request,
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const body = await parseJsonBody(request);
      const parsed = parseCreateClinicInput(body);
      if (!parsed.success) {
        throw new OwnerServiceError(400, "VALIDATION_ERROR", parsed.message, {
          fieldErrors: parsed.fieldErrors,
        });
      }

      const clinic = await createOwnerClinic(getAdminClient(), parsed.data);
      return ownerJson({ clinic }, { status: 201 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}

/**
 * Creates the `PATCH /api/owner/clinics/[id]` handler with injectable dependencies for tests.
 */
export function createOwnerClinicPatchHandler(
  deps: OwnerClinicsRouteDeps = {},
): (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleOwnerClinicPatch(
    request: Request,
    context: { params: Promise<{ id: string }> },
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const { id: rawId } = await context.params;
      const id = requireUuidOrThrow(rawId, "العيادة");
      const body = await parseJsonBody(request);
      const parsed = parseUpdateClinicInput(body);
      if (!parsed.success) {
        throw new OwnerServiceError(400, "VALIDATION_ERROR", parsed.message, {
          fieldErrors: parsed.fieldErrors,
        });
      }

      const clinic = await updateOwnerClinic(getAdminClient(), id, parsed.data);
      return ownerJson({ clinic }, { status: 200 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}
