import * as React from "react";

import { ReceptionistTodayView } from "@/components/dashboard/receptionist-today-view";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { requireReceptionistPage } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ReceptionistServiceError,
  getReceptionistTodayDashboard,
} from "@/services/receptionist-appointments";
import type { ReceptionistTodayDashboard } from "@/types/receptionist";

const DEFAULT_LOAD_ERROR =
  "مقدرناش نحمّل مواعيد النهارده دلوقتي، حاول تاني بعد شوية.";

function ReceptionistTodayLoadingFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <LoadingState
        title="بنحمّل مواعيد النهارده..."
        description="استنى لحظة وبنجيب لك مواعيد العيادة."
      />
    </div>
  );
}

async function ReceptionistTodayContent() {
  const staff = await requireReceptionistPage("/receptionist");

  let dashboard: ReceptionistTodayDashboard | null = null;
  let loadError: string | null = null;

  try {
    dashboard = await getReceptionistTodayDashboard(createAdminClient(), staff);
  } catch (error) {
    loadError =
      error instanceof ReceptionistServiceError
        ? error.message
        : DEFAULT_LOAD_ERROR;
  }

  if (loadError || !dashboard) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader
          title="مواعيد النهارده"
          description="هنا هتلاقي حجوزات النهارده للعيادة، وتقدر تسجّل وصول المرضى."
        />
        <ErrorState
          title="مقدرناش نحمّل مواعيد النهارده"
          description={loadError ?? DEFAULT_LOAD_ERROR}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <ReceptionistTodayView initialDashboard={dashboard} />
    </div>
  );
}

export default function ReceptionistHomePage() {
  return (
    <React.Suspense fallback={<ReceptionistTodayLoadingFallback />}>
      <ReceptionistTodayContent />
    </React.Suspense>
  );
}
