import Link from "next/link";
import * as React from "react";

import { OwnerDoctorScheduleManager } from "@/components/dashboard/owner-doctor-schedule-manager";
import { buttonVariants } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { requireOwnerPage } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseUuidParam } from "@/lib/validations/owner";
import { OwnerServiceError } from "@/services/owner-errors";
import { getDoctorSchedules } from "@/services/owner-schedules";
import type { OwnerDoctorSchedules } from "@/types/owner";

async function DoctorScheduleContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwnerPage("/owner/doctors");

  const { id } = await params;
  const parsedId = parseUuidParam(id, "الدكتور");
  if (!parsedId.success) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <ErrorState
          title="رابط الدكتور مش صحيح"
          description={parsedId.message}
          action={
            <Link
              href="/owner/doctors"
              className={buttonVariants({ variant: "outline", size: "default" })}
            >
              الرجوع للدكاترة
            </Link>
          }
        />
      </div>
    );
  }

  let initialData: OwnerDoctorSchedules;
  try {
    initialData = await getDoctorSchedules(createAdminClient(), parsedId.id);
  } catch (error) {
    const isNotFound =
      error instanceof OwnerServiceError && error.status === 404;
    const message =
      error instanceof OwnerServiceError
        ? error.message
        : "مش قادرين نجيب جدول الدكتور دلوقتي، حاول تاني بعد شوية.";

    return (
      <div className="mx-auto w-full max-w-6xl">
        <ErrorState
          title={
            isNotFound ? "الدكتور ده مش موجود" : "حصلت مشكلة في تحميل الجدول"
          }
          description={message}
          action={
            <Link
              href="/owner/doctors"
              className={buttonVariants({ variant: "outline", size: "default" })}
            >
              الرجوع للدكاترة
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <OwnerDoctorScheduleManager
      key={initialData.doctor.id}
      initialData={initialData}
    />
  );
}

export default function OwnerDoctorSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto w-full max-w-6xl">
          <LoadingState
            title="بنحمّل جدول الدكتور..."
            description="استنى لحظة وبنجيب لك الجدول الأسبوعي والمواعيد الإضافية والاستثناءات."
          />
        </div>
      }
    >
      <DoctorScheduleContent params={params} />
    </React.Suspense>
  );
}
