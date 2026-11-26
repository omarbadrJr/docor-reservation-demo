import type { AdminRole } from "./database";

export type AuthErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_INACTIVE"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INTERNAL_ERROR";

export interface StaffProfile {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  clinicId: string | null;
  clinicName: string | null;
  isActive: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
  next?: string;
}

export interface LoginResponse {
  user: StaffProfile;
  redirectTo: string;
}

export interface AuthErrorResponse {
  error: string;
  code: AuthErrorCode;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
  retryAfterSeconds?: number;
}
