"use client";

import { Loader2, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_LOGOUT_ERROR = "مقدرناش نسجّل خروجك دلوقتي، جرّب تاني.";
const DEFAULT_CONNECTION_ERROR = "حصلت مشكلة في الاتصال، جرّب تاني.";

export type LogoutButtonVariant = "sidebar" | "header";

export interface LogoutButtonProps {
  variant?: LogoutButtonVariant;
  className?: string;
}

export interface LogoutButtonViewProps {
  variant?: LogoutButtonVariant;
  className?: string;
  isPending: boolean;
  error: string | null;
  onLogout: () => void;
}

/**
 * Sends a POST request to `/api/admin/logout` and normalizes API or network
 * failures into user-facing Egyptian Arabic error messages.
 */
export async function requestLogout(
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetchImpl("/api/admin/logout", {
      method: "POST",
    });

    if (response.ok) {
      return { ok: true };
    }

    try {
      const body = (await response.json()) as { error?: unknown } | null;
      if (typeof body?.error === "string" && body.error.trim().length > 0) {
        return { ok: false, error: body.error.trim() };
      }
    } catch {
      // Fall back to default error message when response body is not JSON.
    }

    return { ok: false, error: DEFAULT_LOGOUT_ERROR };
  } catch {
    return { ok: false, error: DEFAULT_CONNECTION_ERROR };
  }
}

/**
 * Pure presentation view for the staff logout button and inline error state.
 */
export function LogoutButtonView({
  variant = "sidebar",
  className,
  isPending,
  error,
  onLogout,
}: LogoutButtonViewProps) {
  const buttonClassName =
    variant === "sidebar"
      ? "min-h-11 w-full justify-center gap-2 border border-sidebar-border bg-sidebar-accent/70 px-4 text-sm font-bold text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:border-sidebar-ring focus-visible:ring-3 focus-visible:ring-sidebar-ring/40"
      : "min-h-11 h-auto justify-center gap-2 border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-background hover:bg-white/20 hover:text-background focus-visible:border-sidebar-ring focus-visible:ring-3 focus-visible:ring-sidebar-ring/40 sm:text-sm";

  return (
    <div
      className={cn(
        variant === "sidebar"
          ? "flex flex-col gap-1.5"
          : "inline-flex flex-col items-end gap-1",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        disabled={isPending}
        aria-busy={isPending || undefined}
        onClick={onLogout}
        className={buttonClassName}
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span>جاري الخروج...</span>
          </>
        ) : (
          <>
            <LogOut className="size-4" aria-hidden="true" />
            <span>تسجيل الخروج</span>
          </>
        )}
      </Button>

      {error ? (
        <p
          role="alert"
          aria-live="assertive"
          className={cn(
            "rounded-md border border-red-300/30 bg-red-950/60 px-2.5 py-1.5 text-right text-xs font-medium leading-5 text-red-100",
            variant === "header" && "max-w-56",
          )}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Interactive staff logout control that invalidates the server session and
 * redirects back to `/login`.
 */
export function LogoutButton({
  variant = "sidebar",
  className,
}: LogoutButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      setIsPending(false);
      setError(null);
    };
  }, []);

  async function handleLogout() {
    if (isPending) {
      return;
    }

    setIsPending(true);
    setError(null);

    const result = await requestLogout();
    if (!result.ok) {
      setError(result.error);
      setIsPending(false);
      return;
    }

    window.location.replace("/login");
  }

  return (
    <LogoutButtonView
      variant={variant}
      className={className}
      isPending={isPending}
      error={error}
      onLogout={() => void handleLogout()}
    />
  );
}
