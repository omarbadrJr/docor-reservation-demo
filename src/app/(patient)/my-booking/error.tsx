"use client";

import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/ui/state";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader title="عندي حجز بالفعل" />
      <ErrorState
        className="mt-8"
        title="مش قادرين نعرض الصفحة دلوقتي"
        description="حصلت مشكلة مؤقتة. جرّب تاني."
        action={
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-md bg-primary px-5 py-2 font-bold text-primary-foreground"
          >
            جرّب تاني
          </button>
        }
      />
    </div>
  );
}
