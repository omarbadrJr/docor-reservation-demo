import { z } from "zod";

import type { LoginInput } from "@/types/auth";
import type { AdminRole } from "@/types/database";

const EMAIL_REQUIRED_ERROR = "اكتب البريد الإلكتروني";
const EMAIL_INVALID_ERROR = "اكتب بريد إلكتروني صحيح";
const PASSWORD_REQUIRED_ERROR = "اكتب كلمة المرور";
const PASSWORD_MAX_ERROR = "كلمة المرور طويلة جداً";
const GENERIC_LOGIN_ERROR = "بيانات الدخول مش مظبوطة، راجعها وحاول تاني.";

const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;
const DUMMY_REDIRECT_ORIGIN = "https://redirect.invalid";
const emailValidator = z.email();

export const loginFormSchema = z.object({
  email: z
    .string({ error: EMAIL_REQUIRED_ERROR })
    .refine((val) => val.trim().length > 0, EMAIL_REQUIRED_ERROR)
    .refine(
      (val) =>
        val.trim().length === 0 || emailValidator.safeParse(val.trim()).success,
      EMAIL_INVALID_ERROR,
    ),
  password: z
    .string({ error: PASSWORD_REQUIRED_ERROR })
    .min(1, PASSWORD_REQUIRED_ERROR)
    .max(128, PASSWORD_MAX_ERROR),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

/**
 * Validates and normalizes an incoming staff login request payload.
 */
export function parseLoginInput(payload: unknown):
  | {
      success: true;
      data: LoginInput;
    }
  | {
      success: false;
      message: string;
      fieldErrors: Partial<Record<"email" | "password", string>>;
    } {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return {
      success: false,
      message: GENERIC_LOGIN_ERROR,
      fieldErrors: {},
    };
  }

  const record = payload as Record<string, unknown>;
  const normalizedEmail =
    typeof record.email === "string"
      ? record.email.trim().toLowerCase()
      : record.email;

  const parsed = loginFormSchema.safeParse({
    email: normalizedEmail,
    password: record.password,
  });

  if (!parsed.success) {
    const fieldErrors: Partial<Record<"email" | "password", string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if ((field === "email" || field === "password") && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }

    const messages = Object.values(fieldErrors).filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );

    return {
      success: false,
      message: messages.length === 1 ? messages[0] : GENERIC_LOGIN_ERROR,
      fieldErrors,
    };
  }

  const data: LoginInput = {
    email: parsed.data.email,
    password: parsed.data.password,
  };

  if (typeof record.next === "string") {
    data.next = record.next;
  }

  return {
    success: true,
    data,
  };
}

/**
 * Returns the canonical dashboard path for an authenticated staff role.
 */
export function getDefaultDashboardPath(
  role: AdminRole,
): "/owner" | "/receptionist" {
  return role === "OWNER" ? "/owner" : "/receptionist";
}

/**
 * Sanitizes a post-login redirect target so it stays strictly within the
 * authenticated staff member's own dashboard path prefix.
 */
export function sanitizeRedirectPath(
  nextPath: string | null | undefined,
  role: AdminRole,
): string {
  const fallback = getDefaultDashboardPath(role);

  if (typeof nextPath !== "string" || CONTROL_CHAR_PATTERN.test(nextPath)) {
    return fallback;
  }

  const trimmed = nextPath.trim();
  if (
    trimmed.length === 0 ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\")
  ) {
    return fallback;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed, DUMMY_REDIRECT_ORIGIN);
  } catch {
    return fallback;
  }

  if (parsed.origin !== DUMMY_REDIRECT_ORIGIN || parsed.pathname.includes("//")) {
    return fallback;
  }

  for (const segment of parsed.pathname.split("/")) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return fallback;
    }

    if (
      decoded === "." ||
      decoded === ".." ||
      decoded.includes("/") ||
      decoded.includes("\\")
    ) {
      return fallback;
    }
  }

  if (
    parsed.pathname !== fallback &&
    !parsed.pathname.startsWith(`${fallback}/`)
  ) {
    return fallback;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
