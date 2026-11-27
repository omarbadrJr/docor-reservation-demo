import type { Metadata } from "next";
import * as React from "react";

import { OwnerClinicsManager } from "@/components/dashboard/owner-clinics-manager";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { requireOwnerPage } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { listOwnerClinics } from "@/services/owner-clinics";
import type { OwnerClinic } from "@/types/owner";

export const metadata: Metadata = {
  title: "العيادات | لوحة صاحب الموقع",
};

async function OwnerClinicsContent() {
  await requireOwnerPage("/owner/clinics");

  let clinics: OwnerClinic[] | null = null;
  try {
    clinics = await listOwnerClinics(createAdminClient());
  } catch {
    clinics = null;
  }

  if (!clinics) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="العيادات"
          description="إدارة العيادات المسجلة على المنصة، وتحديث عناوينها وأرقام التليفون وحالة الظهور."
        />
        <ErrorState
          title="مش قادرين نحمّل العيادات دلوقتي"
          description="حصلت مشكلة وإحنا بنجيب البيانات، حدّث الصفحة وحاول تاني."
        />
      </div>
    );
  }

  return <OwnerClinicsManager initialClinics={clinics} />;
}

export default function OwnerClinicsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <React.Suspense
        fallback={
          <LoadingState
            title="بنحمّل العيادات..."
            description="استنى لحظة وهتظهر قدامك كل العيادات المسجلة."
          />
        }
      >
        <OwnerClinicsContent />
      </React.Suspense>
    </div>
  );
}
