import * as React from "react";

import { OwnerOverview } from "@/components/dashboard/owner-overview";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { requireOwnerPage } from "@/lib/auth/guards";
import { getCairoNow } from "@/lib/cairo-time";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnerDashboardOverview } from "@/services/owner-appointments";

import type { OwnerDashboardOverview } from "@/types/owner";

async function OwnerOverviewContent() {
  await requireOwnerPage("/owner");

  let overview: OwnerDashboardOverview | null = null;
  try {
    const adminClient = createAdminClient();
    overview = await getOwnerDashboardOverview(adminClient, getCairoNow());
  } catch {
    overview = null;
  }

  if (!overview) {
    return (
      <div>
        <PageHeader
          title="نظرة عامة"
          description="ملخص العيادات والدكاترة والحجوزات في المنصة."
        />
        <ErrorState
          className="mt-8"
          title="ما قدرناش نحمّل لوحة التحكم"
          description="حصلت مشكلة وإحنا بنحمّل بيانات المنصة. حدّث الصفحة وحاول تاني."
        />
      </div>
    );
  }

  return <OwnerOverview overview={overview} />;
}

export default function OwnerHomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <React.Suspense
        fallback={
          <LoadingState
            title="بنحمّل نظرة عامة..."
            description="استنى لحظة وبنجهّز لك ملخص العيادات والحجوزات."
          />
        }
      >
        <OwnerOverviewContent />
      </React.Suspense>
    </div>
  );
}
