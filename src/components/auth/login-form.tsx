"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Home,
  Loader2,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  loginFormSchema,
  type LoginFormValues,
} from "@/lib/validations/auth";
import type { AuthErrorResponse, LoginResponse } from "@/types/auth";

const INACTIVE_ACCOUNT_MESSAGE =
  "الحساب ده غير نشط حالياً. تواصل مع إدارة المنصة.";
const DEFAULT_CONNECTION_ERROR =
  "حصلت مشكلة في الاتصال، تأكد من الإنترنت وحاول تاني.";

export interface LoginFormProps {
  nextPath?: string;
  initialReason?: string;
}

/**
 * Formats a user-facing Arabic wait hint when login attempts are rate-limited.
 */
export function formatRetryAfterHint(
  code: AuthErrorResponse["code"] | undefined,
  retryAfterSeconds: number | undefined,
): string | null {
  if (
    code !== "RATE_LIMITED" ||
    typeof retryAfterSeconds !== "number" ||
    !Number.isFinite(retryAfterSeconds) ||
    retryAfterSeconds <= 0
  ) {
    return null;
  }

  return `تقدر تحاول تاني بعد ${Math.ceil(retryAfterSeconds)} ثانية.`;
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function LoginForm({ nextPath, initialReason }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(
    initialReason === "inactive" ? INACTIVE_ACCOUNT_MESSAGE : null,
  );
  const [retryHint, setRetryHint] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    return () => {
      reset({ email: "", password: "" });
      setShowPassword(false);
      setFormError(null);
      setRetryHint(null);
      setIsSubmitting(false);
    };
  }, [reset]);

  async function onSubmit(values: LoginFormValues) {
    setIsSubmitting(true);
    setFormError(null);
    setRetryHint(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: values.email.trim(),
          password: values.password,
          next: nextPath,
        }),
      });

      if (!response.ok) {
        const errorData = await parseJsonSafe<AuthErrorResponse>(response);
        if (errorData?.fieldErrors?.email) {
          setError("email", {
            type: "server",
            message: errorData.fieldErrors.email,
          });
        }
        if (errorData?.fieldErrors?.password) {
          setError("password", {
            type: "server",
            message: errorData.fieldErrors.password,
          });
        }

        setRetryHint(
          formatRetryAfterHint(errorData?.code, errorData?.retryAfterSeconds),
        );
        setFormError(errorData?.error ?? DEFAULT_CONNECTION_ERROR);
        setIsSubmitting(false);
        return;
      }

      const data = await parseJsonSafe<LoginResponse>(response);
      if (!data?.redirectTo) {
        setFormError(DEFAULT_CONNECTION_ERROR);
        setIsSubmitting(false);
        return;
      }

      window.location.replace(data.redirectTo);
    } catch {
      setFormError(DEFAULT_CONNECTION_ERROR);
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="login-form-heading">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-card pb-5">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Stethoscope className="size-5" aria-hidden="true" />
            </span>
            <span className="font-heading text-sm font-extrabold text-muted-foreground">
              حجز دكتور — عيادات البحيرة
            </span>
          </div>

          <h1
            id="login-form-heading"
            className="font-heading text-2xl leading-snug font-extrabold text-foreground sm:text-3xl"
          >
            دخول الإدارة والاستقبال
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            الدخول ده خاص بموظفي استقبال العيادات وإدارة المنصة بس. لو إنت مريض
            وعايز تحجز، مش محتاج حساب.
          </p>
        </CardHeader>

        <CardContent className="pt-6">
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-5"
          >
            {formError ? (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 font-semibold text-destructive"
              >
                <AlertCircle
                  className="mt-0.5 size-5 shrink-0"
                  aria-hidden="true"
                />
                <div className="space-y-1">
                  <p>{formError}</p>
                  {retryHint ? <p className="font-bold">{retryHint}</p> : null}
                </div>
              </div>
            ) : null}

            <Field
              label="البريد الإلكتروني"
              htmlFor="login-email"
              required
              error={errors.email?.message}
            >
              <Input
                id="login-email"
                type="email"
                inputMode="email"
                dir="ltr"
                autoComplete="email"
                placeholder="name@example.com"
                required
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.email)}
                className="text-left"
                {...register("email")}
              />
            </Field>

            <Field
              label="كلمة المرور"
              htmlFor="login-password"
              required
              error={errors.password?.message}
            >
              <div className="relative" dir="ltr">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  dir="ltr"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.password)}
                  className="pr-13 text-left"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  disabled={isSubmitting}
                  aria-label={
                    showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                  }
                  aria-pressed={showPassword}
                  className="absolute top-1/2 right-1 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff className="size-5" aria-hidden="true" />
                  ) : (
                    <Eye className="size-5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </Field>

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2
                    className="size-5 animate-spin"
                    aria-hidden="true"
                  />
                  جاري تسجيل الدخول...
                </>
              ) : (
                "تسجيل الدخول"
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex-col items-stretch border-t border-border pt-4">
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "w-full",
            )}
          >
            <Home className="size-4" aria-hidden="true" />
            رجوع لصفحة الحجز
          </Link>
        </CardFooter>
      </Card>
    </section>
  );
}
