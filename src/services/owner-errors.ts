import type { OwnerErrorCode } from "@/types/owner";

export type OwnerErrorStatus = 400 | 401 | 403 | 404 | 409 | 500;

export class OwnerServiceError extends Error {
  readonly status: OwnerErrorStatus;
  readonly code: OwnerErrorCode;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    status: OwnerErrorStatus,
    code: OwnerErrorCode,
    message: string,
    details?: {
      fieldErrors?: Record<string, string>;
    },
  ) {
    super(message);
    this.name = "OwnerServiceError";
    this.status = status;
    this.code = code;
    this.fieldErrors = details?.fieldErrors;
  }
}

export interface OwnerDbErrorMessages {
  conflict?: string;
  notFound?: string;
  invalidReference?: string;
  constraint?: string;
  fallback: string;
}

const DEFAULT_CONFLICT_MESSAGE = "البيانات دي موجودة بالفعل.";
const DEFAULT_INVALID_REFERENCE_MESSAGE = "البيان المرتبط مش موجود أو مش صحيح.";
const DEFAULT_CONSTRAINT_MESSAGE = "البيانات مش مظبوطة، راجعها وحاول تاني.";
const DEFAULT_NOT_FOUND_MESSAGE = "البيان المطلوب مش موجود.";

/**
 * Maps PostgREST / PostgreSQL error codes into safe, localized `OwnerServiceError`
 * instances without leaking raw database messages or constraint details.
 */
export function mapOwnerDbError(
  error: { code?: string; message?: string; details?: string } | null | undefined,
  messages: OwnerDbErrorMessages,
): OwnerServiceError {
  switch (error?.code) {
    case "23505":
      return new OwnerServiceError(
        409,
        "CONFLICT",
        messages.conflict ?? DEFAULT_CONFLICT_MESSAGE,
      );
    case "23503":
      return new OwnerServiceError(
        400,
        "VALIDATION_ERROR",
        messages.invalidReference ?? DEFAULT_INVALID_REFERENCE_MESSAGE,
      );
    case "23514":
    case "22P02":
      return new OwnerServiceError(
        400,
        "VALIDATION_ERROR",
        messages.constraint ?? DEFAULT_CONSTRAINT_MESSAGE,
      );
    case "PGRST116":
      return new OwnerServiceError(
        404,
        "NOT_FOUND",
        messages.notFound ?? DEFAULT_NOT_FOUND_MESSAGE,
      );
    default:
      return new OwnerServiceError(500, "INTERNAL_ERROR", messages.fallback);
  }
}
