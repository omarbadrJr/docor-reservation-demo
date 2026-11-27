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
  parseCreateReceptionistInput,
  parseUpdateReceptionistInput,
} from "@/lib/validations/owner";
import { mapOwnerDbError, OwnerServiceError } from "@/services/owner-errors";
import type { StaffProfile } from "@/types/auth";
import type { AdminProfile, AdminRole, Database } from "@/types/database";
import type {
  CreateReceptionistInput,
  OwnerReceptionist,
  UpdateReceptionistInput,
} from "@/types/owner";

const DUPLICATE_EMAIL_MESSAGE = "البريد الإلكتروني ده مستخدم لحساب تاني بالفعل.";
const MISSING_CLINIC_MESSAGE = "العيادة المختارة مش موجودة.";
const NOT_FOUND_MESSAGE = "حساب موظف الاستقبال ده مش موجود.";
const EMPTY_UPDATE_MESSAGE = "لازم تبعت بيان واحد على الأقل للتعديل.";
const UNKNOWN_CLINIC_LABEL = "عيادة غير معروفة";
const LIST_RECEPTIONISTS_ERROR_MESSAGE =
  "مش قادرين نحمّل حسابات موظفي الاستقبال دلوقتي، حاول تاني بعد شوية.";
const LIST_CLINICS_ERROR_MESSAGE =
  "مش قادرين نحمّل قائمة العيادات دلوقتي، حاول تاني بعد شوية.";
const CLINIC_LOOKUP_ERROR_MESSAGE =
  "مش قادرين نتحقق من العيادة دلوقتي، حاول تاني بعد شوية.";
const CREATE_AUTH_USER_ERROR_MESSAGE =
  "مش قادرين ننشئ بيانات الدخول للحساب دلوقتي، حاول تاني بعد شوية.";
const CREATE_RECEPTIONIST_ERROR_MESSAGE =
  "مش قادرين ننشئ حساب موظف الاستقبال دلوقتي، حاول تاني بعد شوية.";
const UPDATE_RECEPTIONIST_ERROR_MESSAGE =
  "مش قادرين نحدّث بيانات موظف الاستقبال دلوقتي، حاول تاني بعد شوية.";

export interface OwnerClinicOption {
  id: string;
  name: string;
  isActive: boolean;
}

export interface OwnerReceptionistsHandlerDeps {
  requireAdmin?: (allowedRoles?: readonly AdminRole[]) => Promise<StaffProfile>;
  getAdminClient?: () => SupabaseClient<Database>;
}

type AdminProfileReceptionistRow = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  clinic_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ClinicSummaryRow = {
  id: string;
  name: string;
  is_active: boolean;
};

function hydrateReceptionist(
  row: AdminProfileReceptionistRow,
  clinic: ClinicSummaryRow | null | undefined,
): OwnerReceptionist {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    clinicId: row.clinic_id ?? clinic?.id ?? "",
    clinicName: clinic?.name ?? UNKNOWN_CLINIC_LABEL,
    clinicIsActive: clinic?.is_active ?? false,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isDuplicateAuthEmailError(error: {
  code?: unknown;
  message?: unknown;
}): boolean {
  const code = typeof error.code === "string" ? error.code.toLowerCase() : "";
  if (
    code === "email_exists" ||
    code === "user_already_exists" ||
    code === "email_address_already_exists"
  ) {
    return true;
  }

  const message =
    typeof error.message === "string" ? error.message.toLowerCase() : "";
  return (
    message.includes("already been registered") ||
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("email exists") ||
    message.includes("duplicate")
  );
}

async function fetchClinicOrThrow(
  adminClient: SupabaseClient<Database>,
  clinicId: string,
): Promise<ClinicSummaryRow> {
  const { data, error } = await adminClient
    .from("clinics")
    .select("id, name, is_active")
    .eq("id", clinicId)
    .maybeSingle();

  if (error) {
    throw mapOwnerDbError(error, {
      fallback: CLINIC_LOOKUP_ERROR_MESSAGE,
    });
  }

  const clinic = data as ClinicSummaryRow | null;
  if (!clinic) {
    throw new OwnerServiceError(
      400,
      "VALIDATION_ERROR",
      MISSING_CLINIC_MESSAGE,
      { fieldErrors: { clinicId: MISSING_CLINIC_MESSAGE } },
    );
  }

  return clinic;
}

async function rollbackCreatedAuthUser(
  adminClient: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  try {
    const result = await adminClient.auth.admin.deleteUser(userId);
    if (result?.error) {
      console.error(
        "[owner-receptionists] rollback deleteUser failed:",
        result.error.message,
      );
    }
  } catch (error) {
    console.error(
      "[owner-receptionists] rollback deleteUser threw:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Lists all receptionist accounts ordered by name with their assigned clinic info.
 */
export async function listOwnerReceptionists(
  adminClient: SupabaseClient<Database>,
): Promise<OwnerReceptionist[]> {
  const { data, error } = await adminClient
    .from("admin_profiles")
    .select(
      "id, name, email, role, clinic_id, is_active, created_at, updated_at",
    )
    .eq("role", "RECEPTIONIST")
    .order("name", { ascending: true });

  if (error) {
    throw mapOwnerDbError(error, {
      fallback: LIST_RECEPTIONISTS_ERROR_MESSAGE,
    });
  }

  const rows = ((data ?? []) as AdminProfileReceptionistRow[]).filter(
    (row) => row.role === "RECEPTIONIST" && row.clinic_id !== null,
  );

  if (rows.length === 0) {
    return [];
  }

  const clinicIds = Array.from(
    new Set(rows.map((row) => row.clinic_id as string)),
  );

  const { data: clinicsData, error: clinicsError } = await adminClient
    .from("clinics")
    .select("id, name, is_active")
    .in("id", clinicIds);

  if (clinicsError) {
    throw mapOwnerDbError(clinicsError, {
      fallback: LIST_CLINICS_ERROR_MESSAGE,
    });
  }

  const clinicsById = new Map<string, ClinicSummaryRow>(
    ((clinicsData ?? []) as ClinicSummaryRow[]).map((clinic) => [
      clinic.id,
      clinic,
    ]),
  );

  return rows.map((row) =>
    hydrateReceptionist(row, clinicsById.get(row.clinic_id as string)),
  );
}

/**
 * Lists all clinics for receptionist assignment and filtering, ordered by name.
 */
export async function listClinicOptionsForReceptionists(
  adminClient: SupabaseClient<Database>,
): Promise<OwnerClinicOption[]> {
  const { data, error } = await adminClient
    .from("clinics")
    .select("id, name, is_active")
    .order("name", { ascending: true });

  if (error) {
    throw mapOwnerDbError(error, {
      fallback: LIST_CLINICS_ERROR_MESSAGE,
    });
  }

  return ((data ?? []) as ClinicSummaryRow[]).map((clinic) => ({
    id: clinic.id,
    name: clinic.name,
    isActive: clinic.is_active,
  }));
}

/**
 * Creates a Supabase Auth receptionist user and matching `admin_profiles` row,
 * rolling back the Auth user if profile insertion fails.
 */
export async function createOwnerReceptionist(
  adminClient: SupabaseClient<Database>,
  input: CreateReceptionistInput,
): Promise<OwnerReceptionist> {
  const trimmedName = input.name.trim();
  const normalizedEmail = input.email.trim().toLowerCase();

  const clinic = await fetchClinicOrThrow(adminClient, input.clinicId);

  const { data: existingProfile, error: existingError } = await adminClient
    .from("admin_profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingError) {
    throw mapOwnerDbError(existingError, {
      fallback: CREATE_RECEPTIONIST_ERROR_MESSAGE,
    });
  }

  if (existingProfile) {
    throw new OwnerServiceError(409, "CONFLICT", DUPLICATE_EMAIL_MESSAGE, {
      fieldErrors: { email: DUPLICATE_EMAIL_MESSAGE },
    });
  }

  const { data: authData, error: authError } =
    await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        name: trimmedName,
        role: "RECEPTIONIST",
      },
    });

  if (authError) {
    if (isDuplicateAuthEmailError(authError)) {
      throw new OwnerServiceError(409, "CONFLICT", DUPLICATE_EMAIL_MESSAGE, {
        fieldErrors: { email: DUPLICATE_EMAIL_MESSAGE },
      });
    }

    throw new OwnerServiceError(
      500,
      "INTERNAL_ERROR",
      CREATE_AUTH_USER_ERROR_MESSAGE,
    );
  }

  const createdUserId = authData?.user?.id;
  if (!createdUserId) {
    throw new OwnerServiceError(
      500,
      "INTERNAL_ERROR",
      CREATE_AUTH_USER_ERROR_MESSAGE,
    );
  }

  let insertedRow: AdminProfileReceptionistRow | null = null;
  let insertError: {
    code?: string;
    message?: string;
    details?: string;
  } | null = null;

  try {
    const result = await adminClient
      .from("admin_profiles")
      .insert({
        id: createdUserId,
        name: trimmedName,
        email: normalizedEmail,
        role: "RECEPTIONIST",
        clinic_id: input.clinicId,
        is_active: true,
      })
      .select(
        "id, name, email, role, clinic_id, is_active, created_at, updated_at",
      )
      .single();

    insertedRow = (result.data as AdminProfileReceptionistRow | null) ?? null;
    insertError = result.error ?? null;
  } catch {
    await rollbackCreatedAuthUser(adminClient, createdUserId);
    throw new OwnerServiceError(
      500,
      "INTERNAL_ERROR",
      CREATE_RECEPTIONIST_ERROR_MESSAGE,
    );
  }

  if (insertError || !insertedRow) {
    await rollbackCreatedAuthUser(adminClient, createdUserId);

    if (insertError?.code === "23505") {
      throw new OwnerServiceError(409, "CONFLICT", DUPLICATE_EMAIL_MESSAGE, {
        fieldErrors: { email: DUPLICATE_EMAIL_MESSAGE },
      });
    }

    if (insertError?.code === "23503") {
      throw new OwnerServiceError(
        400,
        "VALIDATION_ERROR",
        MISSING_CLINIC_MESSAGE,
        { fieldErrors: { clinicId: MISSING_CLINIC_MESSAGE } },
      );
    }

    if (insertError) {
      throw mapOwnerDbError(insertError, {
        conflict: DUPLICATE_EMAIL_MESSAGE,
        invalidReference: MISSING_CLINIC_MESSAGE,
        fallback: CREATE_RECEPTIONIST_ERROR_MESSAGE,
      });
    }

    throw new OwnerServiceError(
      500,
      "INTERNAL_ERROR",
      CREATE_RECEPTIONIST_ERROR_MESSAGE,
    );
  }

  return hydrateReceptionist(insertedRow, clinic);
}

/**
 * Updates an existing receptionist's name, clinic assignment, or active flag.
 * Strictly refuses to inspect or modify `OWNER` profiles.
 */
export async function updateOwnerReceptionist(
  adminClient: SupabaseClient<Database>,
  id: string,
  input: UpdateReceptionistInput,
): Promise<OwnerReceptionist> {
  const updatePayload: Partial<AdminProfile> = {};

  if (input.name !== undefined) {
    updatePayload.name = input.name.trim();
  }
  if (input.clinicId !== undefined) {
    updatePayload.clinic_id = input.clinicId;
  }
  if (input.isActive !== undefined) {
    updatePayload.is_active = input.isActive;
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new OwnerServiceError(400, "VALIDATION_ERROR", EMPTY_UPDATE_MESSAGE);
  }

  const { data: existingData, error: fetchError } = await adminClient
    .from("admin_profiles")
    .select(
      "id, name, email, role, clinic_id, is_active, created_at, updated_at",
    )
    .eq("id", id)
    .eq("role", "RECEPTIONIST")
    .maybeSingle();

  if (fetchError) {
    throw mapOwnerDbError(fetchError, {
      fallback: UPDATE_RECEPTIONIST_ERROR_MESSAGE,
    });
  }

  const existing = existingData as AdminProfileReceptionistRow | null;
  if (!existing || existing.role !== "RECEPTIONIST") {
    throw new OwnerServiceError(404, "NOT_FOUND", NOT_FOUND_MESSAGE);
  }

  let clinic: ClinicSummaryRow | null = null;
  if (input.clinicId !== undefined) {
    clinic = await fetchClinicOrThrow(adminClient, input.clinicId);
  } else if (existing.clinic_id !== null) {
    const { data: clinicData, error: clinicError } = await adminClient
      .from("clinics")
      .select("id, name, is_active")
      .eq("id", existing.clinic_id)
      .maybeSingle();

    if (clinicError) {
      throw mapOwnerDbError(clinicError, {
        fallback: CLINIC_LOOKUP_ERROR_MESSAGE,
      });
    }

    clinic = (clinicData as ClinicSummaryRow | null) ?? null;
  }

  const { data: updatedData, error: updateError } = await adminClient
    .from("admin_profiles")
    .update(updatePayload)
    .eq("id", id)
    .eq("role", "RECEPTIONIST")
    .select(
      "id, name, email, role, clinic_id, is_active, created_at, updated_at",
    )
    .maybeSingle();

  if (updateError) {
    if (updateError.code === "23503") {
      throw new OwnerServiceError(
        400,
        "VALIDATION_ERROR",
        MISSING_CLINIC_MESSAGE,
        { fieldErrors: { clinicId: MISSING_CLINIC_MESSAGE } },
      );
    }

    throw mapOwnerDbError(updateError, {
      notFound: NOT_FOUND_MESSAGE,
      invalidReference: MISSING_CLINIC_MESSAGE,
      fallback: UPDATE_RECEPTIONIST_ERROR_MESSAGE,
    });
  }

  const updated = updatedData as AdminProfileReceptionistRow | null;
  if (!updated || updated.role !== "RECEPTIONIST") {
    throw new OwnerServiceError(404, "NOT_FOUND", NOT_FOUND_MESSAGE);
  }

  return hydrateReceptionist(updated, clinic);
}

/**
 * Creates the `GET /api/owner/receptionists` handler with injectable test dependencies.
 */
export function createOwnerReceptionistsGetHandler(
  deps: OwnerReceptionistsHandlerDeps = {},
): () => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleOwnerReceptionistsGet(): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const adminClient = getAdminClient();
      const receptionists = await listOwnerReceptionists(adminClient);
      return ownerJson({ receptionists }, { status: 200 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}

/**
 * Creates the `POST /api/owner/receptionists` handler with injectable test dependencies.
 */
export function createOwnerReceptionistsPostHandler(
  deps: OwnerReceptionistsHandlerDeps = {},
): (request: Request) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleOwnerReceptionistsPost(
    request: Request,
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const body = await parseJsonBody(request);
      const parsed = parseCreateReceptionistInput(body);
      if (!parsed.success) {
        throw new OwnerServiceError(400, "VALIDATION_ERROR", parsed.message, {
          fieldErrors: parsed.fieldErrors,
        });
      }

      const adminClient = getAdminClient();
      const receptionist = await createOwnerReceptionist(
        adminClient,
        parsed.data,
      );
      return ownerJson({ receptionist }, { status: 201 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}

/**
 * Creates the `PATCH /api/owner/receptionists/[id]` handler with injectable test dependencies.
 */
export function createOwnerReceptionistPatchHandler(
  deps: OwnerReceptionistsHandlerDeps = {},
): (request: Request, rawId: string) => Promise<Response> {
  const requireAdmin = deps.requireAdmin ?? requireAdminApi;
  const getAdminClient = deps.getAdminClient ?? createAdminClient;

  return async function handleOwnerReceptionistPatch(
    request: Request,
    rawId: string,
  ): Promise<Response> {
    try {
      await requireAdmin(["OWNER"]);
      const id = requireUuidOrThrow(rawId, "موظف الاستقبال");
      const body = await parseJsonBody(request);
      const parsed = parseUpdateReceptionistInput(body);
      if (!parsed.success) {
        throw new OwnerServiceError(400, "VALIDATION_ERROR", parsed.message, {
          fieldErrors: parsed.fieldErrors,
        });
      }

      const adminClient = getAdminClient();
      const receptionist = await updateOwnerReceptionist(
        adminClient,
        id,
        parsed.data,
      );
      return ownerJson({ receptionist }, { status: 200 });
    } catch (error) {
      return toOwnerErrorResponse(error);
    }
  };
}
