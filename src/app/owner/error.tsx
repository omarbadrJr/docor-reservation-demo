"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/state";

export default function OwnerError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader title="لوحة صاحب المنصة" />
      <ErrorState
        title="حصلت مشكلة في تحميل الصفحة"
        description="حصلت مشكلة مؤقتة وإحنا بنفتح الصفحة. جرّب تاني بعد لحظة."
        action={
          <Button type="button" onClick={reset}>
            جرّب تاني
          </Button>
        }
      />
    </div>
  );
}
