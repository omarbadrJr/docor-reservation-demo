import type { Metadata } from "next";
import * as React from "react";

import { OwnerSpecialtiesManager } from "@/components/dashboard/owner-specialties-manager";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { requireOwnerPage } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { listOwnerSpecialties } from "@/services/owner-specialties";
import type { OwnerSpecialty } from "@/types/owner";

export const metadata: Metadata = {
  title: "التخصصات | لوحة صاحب الموقع",
};

async function OwnerSpecialtiesContent() {
  await requireOwnerPage("/owner/specialties");

  let specialties: OwnerSpecialty[] | null = null;
  try {
    specialties = await listOwnerSpecialties(createAdminClient());
  } catch {
    specialties = null;
  }

  if (!specialties) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="التخصصات"
          description="إدارة التخصصات الطبية اللي بتظهر للمرضى لما يختاروا الدكتور."
        />
        <ErrorState
          title="مش قادرين نحمّل التخصصات دلوقتي"
          description="حصلت مشكلة وإحنا بنجيب البيانات، حدّث الصفحة وحاول تاني."
        />
      </div>
    );
  }

  return <OwnerSpecialtiesManager initialSpecialties={specialties} />;
}

export default function OwnerSpecialtiesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <React.Suspense
        fallback={
          <LoadingState
            title="بنحمّل التخصصات..."
            description="استنى لحظة وهتظهر قدامك كل التخصصات المسجلة."
          />
        }
      >
        <OwnerSpecialtiesContent />
      </React.Suspense>
    </div>
  );
}
