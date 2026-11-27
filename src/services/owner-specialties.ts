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
  parseCreateSpecialtyInput,
  parseUpdateSpecialtyInput,
} from "@/lib/validations/owner";
import { mapOwnerDbError, OwnerServiceError } from "@/services/owner-errors";
import type { StaffProfile } from "@/types/auth";
import type { AdminRole, Database, Specialty } from "@/types/database";
import type {
  CreateSpecialtyInput,
  OwnerSpecialty,
  UpdateSpecialtyInput,
} from "@/types/owner";

const SPECIALTY_COLUMNS =
  "id, name, description, is_active, created_at, updated_at";

const LIST_SPECIALTIES_ERROR =
  "مش قادرين نجيب قائمة التخصصات دلوقتي، حاول تاني بعد شوية.";
const CREATE_SPECIALTY_ERROR =
  "مش قادرين نضيف التخصص دلوقتي، حاول تاني بعد شوية.";
const UPDATE_SPECIALTY_ERROR =
  "مش قادرين نعدّل بيانات التخصص دلوقتي، حاول تاني بعد شوية.";
const SPECIALTY_CONFLICT_ERROR = "التخصص ده موجود بالفعل.";
const SPECIALTY_NOT_FOUND_ERROR = "التخصص ده مش موجود.";
const EMPTY_SPECIALTY_UPDATE_ERROR = "لازم تبعت بيان واحد على الأقل للتعديل.";

export interface OwnerSpecialtiesRouteDeps {
  requireAdmin?: (allowedRoles?: readonly AdminRole[]) => Promise<StaffProfile>;
  getAdminClient?: () => SupabaseClient<Database>;
}

function mapSpecialtyRow(
  row: Specialty,
  doctorCount: number,
): OwnerSpecialty {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    doctorCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Lists all specialties (active and inactive) ordered by name along with their assigned doctor count.
 */
export async function listOwnerSpecialties(
  adminClient: SupabaseClient<Database>,
): Promise<OwnerSpecialty[]> {
  const [specialtiesResult, doctorsResult] = await Promise.all([
    adminClient
      .from("specialties")
      .select(SPECIALTY_COLUMNS)
      .order("name", { ascending: true }),
    adminClient.from("doctors").select("specialty_id"),
  ]);

  if (specialtiesResult.error) {
    throw mapOwnerDbError(specialtiesResult.error, {
      fallback: LIST_SPECIALTIES_ERROR,
    });
  }

  if (doctorsResult.error) {
    throw mapOwnerDbError(doctorsResult.error, {
      fallback: LIST_SPECIALTIES_ERROR,
    });
  }

  const doctorCounts = new Map<string, number>();
  for (const doctor of doctorsResult.data ?? []) {
    doctorCounts.set(
      doctor.specialty_id,
      (doctorCounts.get(doctor.specialty_id) ?? 0) + 1,
    );
  }

  return (specialtiesResult.data ?? []).map((row) =>
    mapSpecialtyRow(row, doctorCounts.get(row.id) ?? 0),
  );
}

/**
 * Creates a new specialty and returns its hydrated `OwnerSpecialty` record.
 */
export async function createOwnerSpecialty(
  adminClient: SupabaseClient<Database>,
  input: CreateSpecialtyInput,
): Promise<OwnerSpecialty> {
  const { data, error } = await adminClient
    .from("specialties")
    .insert({
      name: input.name,
      description: input.description,
      is_active: input.isActive,
    })
    .select(SPECIALTY_COLUMNS)
    .single();

  if (error) {
    throw mapOwnerDbError(error, {
      conflict: SPECIALTY_CONFLICT_ERROR,
      fallback: CREATE_SPECIALTY_ERROR,
    });
  }

  if (!data) {
    throw new OwnerServiceError(500, "INTERNAL_ERROR", CREATE_SPECIALTY_ERROR);
  }

  return mapSpecialtyRow(data, 0);
}

/**
 * Updates an existing specialty by ID and hydrates its assigned doctor count.
 */
export async function updateOwnerSpecialty(
  adminClient: SupabaseClient<Database>,
  id: string,
  input: UpdateSpecialtyInput,
): Promise<OwnerSpecialty> {
  const updates: Database["public"]["Tables"]["specialties"]["Update"] = {};

  if (input.name !== undefined) {
    updates.name = input.name;
  }
  if (input.description !== undefined) {
    updates.description = input.description;
  }
  if (input.isActive !== undefined) {
    updates.is_active = input.isActive;
  }

  if (Object.keys(updates).length === 0) {
    throw new OwnerServiceError(
      400,
      "VALIDATION_ERROR",
      EMPTY_SPECIALTY_UPDATE_ERROR,
    );
  }

  const { data, error } = await adminClient
    .from("specialties")
    .update(updates)
    .eq("id", id)
    .select(SPECIALTY_COLUMNS)
    .maybeSingle();

  if (error) {
    throw mapOwnerDbError(error, {
      conflict: SPECIALTY_CONFLICT_ERROR,
      notFound: SPECIALTY_NOT_FOUND_ERROR,
      fallback: UPDATE_SPECIALTY_ERROR,
    });
  }

  if (!data) {
    throw new OwnerServiceError(404, "NOT_FOUND", SPECIALTY_NOT_FOUND_ERROR);
  }

  const {
    data: doctors,
    count,
    error: countError,
  } = await adminClient
    .from("doctors")
    .select("id", { count: "exact", head: true })
    .eq("specialty_id", id);

  if (countError) {
    throw mapOwnerDbError(countError, {
      fallback: UPDATE_SPECIALTY_ERROR,
    });
  }

  const doctorCount =
    typeof count === "number" ? count : (doctors?.length ?? 0);

  return mapSpecialtyRow(data, doctorCount);
}

/**
 * Creates the `GET /api/owner/specialties` handler with injectable dependencies for tests.
 */
export function createOwnerSpecialtiesGetHandler(
  deps: OwnerSpecialtiesRouteDeps = {},
): () => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleOwnerSpecialtiesGet(): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const specialties = await listOwnerSpecialties(getAdminClient());
      return ownerJson({ specialties }, { status: 200 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}

/**
 * Creates the `POST /api/owner/specialties` handler with injectable dependencies for tests.
 */
export function createOwnerSpecialtiesPostHandler(
  deps: OwnerSpecialtiesRouteDeps = {},
): (request: Request) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleOwnerSpecialtiesPost(
    request: Request,
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const body = await parseJsonBody(request);
      const parsed = parseCreateSpecialtyInput(body);
      if (!parsed.success) {
        throw new OwnerServiceError(400, "VALIDATION_ERROR", parsed.message, {
          fieldErrors: parsed.fieldErrors,
        });
      }

      const specialty = await createOwnerSpecialty(
        getAdminClient(),
        parsed.data,
      );
      return ownerJson({ specialty }, { status: 201 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}

/**
 * Creates the `PATCH /api/owner/specialties/[id]` handler with injectable dependencies for tests.
 */
export function createOwnerSpecialtyPatchHandler(
  deps: OwnerSpecialtiesRouteDeps = {},
): (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleOwnerSpecialtyPatch(
    request: Request,
    context: { params: Promise<{ id: string }> },
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const { id: rawId } = await context.params;
      const id = requireUuidOrThrow(rawId, "التخصص");
      const body = await parseJsonBody(request);
      const parsed = parseUpdateSpecialtyInput(body);
      if (!parsed.success) {
        throw new OwnerServiceError(400, "VALIDATION_ERROR", parsed.message, {
          fieldErrors: parsed.fieldErrors,
        });
      }

      const specialty = await updateOwnerSpecialty(
        getAdminClient(),
        id,
        parsed.data,
      );
      return ownerJson({ specialty }, { status: 200 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}
