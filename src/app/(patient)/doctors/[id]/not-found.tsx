import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/state";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader title="الدكتور غير متاح" />
      <EmptyState
        className="mt-8"
        title="مش لاقيين الدكتور ده"
        description="ممكن يكون الدكتور اتوقف، أو الرقم غلط. اختار تخصص تاني."
        action={
          <Link
            href="/specialties"
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 py-2 font-bold text-primary-foreground"
          >
            اختار التخصص
          </Link>
        }
      />
    </div>
  );
}
