import * as React from "react";

import { OwnerDoctorsManager } from "@/components/dashboard/owner-doctors-manager";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { requireOwnerPage } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listOwnerDoctorFormOptions,
  listOwnerDoctors,
  type OwnerDoctorFormOptions,
} from "@/services/owner-doctors";
import { OwnerServiceError } from "@/services/owner-errors";
import type { OwnerDoctor } from "@/types/owner";

function OwnerDoctorsLoadingFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <LoadingState
        title="بنحمّل الدكاترة..."
        description="استنى لحظة وبنجهز لك قائمة الدكاترة والعيادات والتخصصات."
      />
    </div>
  );
}

async function OwnerDoctorsContent() {
  await requireOwnerPage("/owner/doctors");

  let doctors: OwnerDoctor[] = [];
  let options: OwnerDoctorFormOptions = { clinics: [], specialties: [] };
  let loadError: string | null = null;

  try {
    const adminClient = createAdminClient();
    [doctors, options] = await Promise.all([
      listOwnerDoctors(adminClient),
      listOwnerDoctorFormOptions(adminClient),
    ]);
  } catch (error) {
    loadError =
      error instanceof OwnerServiceError
        ? error.message
        : "مقدرناش نحمّل قائمة الدكاترة دلوقتي، حاول تاني.";
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader
          title="الدكاترة"
          description="إضافة الدكاترة وربط كل دكتور بعيادة وتخصص واحد وتحديد سعر ومدة الكشف."
        />
        <ErrorState title="مقدرناش نحمّل الدكاترة" description={loadError} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <OwnerDoctorsManager initialDoctors={doctors} options={options} />
    </div>
  );
}

export default function OwnerDoctorsPage() {
  return (
    <React.Suspense fallback={<OwnerDoctorsLoadingFallback />}>
      <OwnerDoctorsContent />
    </React.Suspense>
  );
}
