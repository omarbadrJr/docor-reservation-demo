import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { LoadingState } from "@/components/ui/state";
import { getOptionalStaffSession } from "@/lib/auth/guards";
import { sanitizeRedirectPath } from "@/lib/validations/auth";

export const metadata: Metadata = {
  title: "دخول الإدارة والاستقبال",
  description: "تسجيل دخول موظفي استقبال العيادات وإدارة المنصة.",
};

type LoginSearchParams = Promise<{
  next?: string | string[];
  reason?: string | string[];
}>;

function getSingleSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }
  return undefined;
}

function LoginLoadingFallback() {
  return (
    <LoadingState
      title="بنجهّز صفحة الدخول..."
      description="استنى لحظة وهتلاقي نموذج تسجيل الدخول جاهز."
    />
  );
}

async function LoginPageContent({
  searchParams,
}: {
  searchParams: LoginSearchParams;
}) {
  const params = await searchParams;
  const nextParam = getSingleSearchParam(params.next);
  const reasonParam = getSingleSearchParam(params.reason);

  const session = await getOptionalStaffSession();
  if (session) {
    redirect(sanitizeRedirectPath(nextParam, session.role));
  }

  return <LoginForm nextPath={nextParam} initialReason={reasonParam} />;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: LoginSearchParams;
}) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-background px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full max-w-md">
        <Suspense fallback={<LoginLoadingFallback />}>
          <LoginPageContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
