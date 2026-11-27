import * as React from "react";

import { OwnerAppointmentsView } from "@/components/dashboard/owner-appointments-view";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { requireOwnerPage } from "@/lib/auth/guards";
import { getCairoNow } from "@/lib/cairo-time";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listOwnerAppointmentFilterOptions,
  listOwnerAppointments,
} from "@/services/owner-appointments";

import type { OwnerAppointment } from "@/types/owner";

async function OwnerAppointmentsContent() {
  await requireOwnerPage("/owner/appointments");

  let initialAppointments: OwnerAppointment[] | null = null;
  let filterOptions: Awaited<
    ReturnType<typeof listOwnerAppointmentFilterOptions>
  > = { clinics: [], doctors: [] };
  let todayDate = "";

  try {
    const adminClient = createAdminClient();
    todayDate = getCairoNow().date;
    [initialAppointments, filterOptions] = await Promise.all([
      listOwnerAppointments(adminClient),
      listOwnerAppointmentFilterOptions(adminClient),
    ]);
  } catch {
    initialAppointments = null;
  }

  if (!initialAppointments) {
    return (
      <div>
        <PageHeader
          title="الحجوزات"
          description="تابع وفلتر حجوزات كل العيادات والدكاترة من مكان واحد."
        />
        <ErrorState
          className="mt-8"
          title="ما قدرناش نحمّل الحجوزات"
          description="حصلت مشكلة وإحنا بنحمّل حجوزات العيادات. حدّث الصفحة وحاول تاني."
        />
      </div>
    );
  }

  return (
    <OwnerAppointmentsView
      initialAppointments={initialAppointments}
      clinics={filterOptions.clinics}
      doctors={filterOptions.doctors}
      initialTodayDate={todayDate}
    />
  );
}

export default function OwnerAppointmentsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <React.Suspense
        fallback={
          <LoadingState
            title="بنحمّل الحجوزات..."
            description="استنى لحظة وبنجهّز لك حجوزات كل العيادات."
          />
        }
      >
        <OwnerAppointmentsContent />
      </React.Suspense>
    </div>
  );
}
