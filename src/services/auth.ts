import type { SupabaseClient } from "@supabase/supabase-js";

import type { LoginRateLimiter } from "@/lib/auth/rate-limit";
import { sanitizeRedirectPath } from "@/lib/validations/auth";
import type {
  AuthErrorCode,
  LoginInput,
  LoginResponse,
  StaffProfile,
} from "@/types/auth";
import type { AdminRole, Database } from "@/types/database";

const PROFILE_LOOKUP_ERROR_MESSAGE =
  "حصلت مشكلة وإحنا بنراجع بيانات الحساب، حاول تاني بعد شوية.";
const RATE_LIMITED_MESSAGE =
  "جربت كتير تدخل بحساب غلط، استنى شوية وحاول تاني.";
const INVALID_CREDENTIALS_MESSAGE = "البريد الإلكتروني أو كلمة المرور غلط.";
const ACCOUNT_INACTIVE_LOGIN_MESSAGE =
  "الحساب ده غير نشط حالياً. تواصل مع إدارة المنصة.";
const UNAUTHORIZED_MESSAGE = "لازم تسجل دخول الأول.";
const ACCOUNT_INACTIVE_MESSAGE = "الحساب ده غير نشط حالياً.";
const FORBIDDEN_MESSAGE = "معندكش صلاحية تدخل هنا.";
const FORBIDDEN_CLINIC_MESSAGE =
  "معندكش صلاحية تدخل على بيانات عيادة تانية.";

type AdminProfileLookupRow = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  clinic_id: string | null;
  is_active: boolean;
};

type ClinicNameRow = {
  name: string;
};

export class AuthServiceError extends Error {
  readonly status: 400 | 401 | 403 | 429 | 500;
  readonly code: AuthErrorCode;
  readonly fieldErrors?: Partial<Record<"email" | "password", string>>;
  readonly retryAfterSeconds?: number;

  constructor(
    status: 400 | 401 | 403 | 429 | 500,
    code: AuthErrorCode,
    message: string,
    details?: {
      fieldErrors?: Partial<Record<"email" | "password", string>>;
      retryAfterSeconds?: number;
    },
  ) {
    super(message);
    this.name = "AuthServiceError";
    this.status = status;
    this.code = code;
    this.fieldErrors = details?.fieldErrors;
    this.retryAfterSeconds = details?.retryAfterSeconds;
  }
}

/**
 * Loads a staff profile from `admin_profiles` using a server-only admin client
 * and hydrates its assigned clinic name when `clinic_id` is present.
 */
export async function getStaffProfileByUserId(
  adminClient: SupabaseClient<Database>,
  userId: string,
): Promise<StaffProfile | null> {
  const { data, error } = await adminClient
    .from("admin_profiles")
    .select("id, name, email, role, clinic_id, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new AuthServiceError(
      500,
      "INTERNAL_ERROR",
      PROFILE_LOOKUP_ERROR_MESSAGE,
    );
  }

  const row = data as AdminProfileLookupRow | null;
  if (!row) {
    return null;
  }

  let clinicName: string | null = null;
  if (row.clinic_id !== null) {
    const { data: clinicData, error: clinicError } = await adminClient
      .from("clinics")
      .select("name")
      .eq("id", row.clinic_id)
      .maybeSingle();

    if (clinicError) {
      throw new AuthServiceError(
        500,
        "INTERNAL_ERROR",
        PROFILE_LOOKUP_ERROR_MESSAGE,
      );
    }

    const clinic = clinicData as ClinicNameRow | null;
    clinicName = clinic?.name ?? null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    clinicId: row.clinic_id,
    clinicName,
    isActive: row.is_active,
  };
}

/**
 * Resolves the currently authenticated and active staff session, returning `null`
 * if unauthenticated or if the linked staff profile is missing or inactive.
 */
export async function getCurrentStaffSession(
  supabaseClient: SupabaseClient<Database>,
  adminClient: SupabaseClient<Database>,
): Promise<StaffProfile | null> {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error || !data?.user) {
    return null;
  }

  const profile = await getStaffProfileByUserId(adminClient, data.user.id);
  if (!profile || !profile.isActive) {
    return null;
  }

  return profile;
}

/**
 * Authenticates a staff member with Supabase Auth, enforces login rate limiting
 * and active-profile checks, and returns a sanitized role-scoped redirect target.
 */
export async function loginStaff(
  deps: {
    supabaseClient: SupabaseClient<Database>;
    adminClient: SupabaseClient<Database>;
    rateLimiter: LoginRateLimiter;
  },
  input: LoginInput,
  clientIp: string,
): Promise<LoginResponse> {
  const rateLimit = deps.rateLimiter.check(clientIp, input.email);
  if (!rateLimit.allowed) {
    throw new AuthServiceError(429, "RATE_LIMITED", RATE_LIMITED_MESSAGE, {
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
  }

  const { data, error } = await deps.supabaseClient.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error || !data?.user) {
    deps.rateLimiter.recordFailure(clientIp, input.email);
    throw new AuthServiceError(
      401,
      "INVALID_CREDENTIALS",
      INVALID_CREDENTIALS_MESSAGE,
    );
  }

  const profile = await getStaffProfileByUserId(deps.adminClient, data.user.id);
  if (!profile || !profile.isActive) {
    await deps.supabaseClient.auth.signOut();
    throw new AuthServiceError(
      403,
      "ACCOUNT_INACTIVE",
      ACCOUNT_INACTIVE_LOGIN_MESSAGE,
    );
  }

  deps.rateLimiter.reset(clientIp, input.email);

  return {
    user: profile,
    redirectTo: sanitizeRedirectPath(input.next, profile.role),
  };
}

/**
 * Signs out the staff session globally and falls back to local sign-out so
 * cookies are always cleared even when the remote session is already expired.
 */
export async function logoutStaff(
  supabaseClient: SupabaseClient<Database>,
): Promise<void> {
  try {
    const { error } = await supabaseClient.auth.signOut({ scope: "global" });
    if (!error) {
      return;
    }
  } catch {
    // Fall through to local sign-out so browser cookies still clear cleanly.
  }

  await supabaseClient.auth.signOut({ scope: "local" });
}

/**
 * Verifies an authenticated, active staff session and optional role allowlist.
 */
export function assertRole(
  profile: StaffProfile | null,
  allowedRoles?: readonly AdminRole[],
): StaffProfile {
  if (!profile) {
    throw new AuthServiceError(401, "UNAUTHORIZED", UNAUTHORIZED_MESSAGE);
  }

  if (!profile.isActive) {
    throw new AuthServiceError(
      403,
      "ACCOUNT_INACTIVE",
      ACCOUNT_INACTIVE_MESSAGE,
    );
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    throw new AuthServiceError(403, "FORBIDDEN", FORBIDDEN_MESSAGE);
  }

  return profile;
}

/**
 * Enforces clinic isolation: owners can access all clinics, while receptionists
 * are restricted strictly to their assigned clinic.
 */
export function assertClinicAccess(
  profile: StaffProfile,
  clinicId: string,
): void {
  if (profile.role === "OWNER") {
    return;
  }

  if (!profile.clinicId || profile.clinicId !== clinicId) {
    throw new AuthServiceError(403, "FORBIDDEN", FORBIDDEN_CLINIC_MESSAGE);
  }
}
