import * as React from "react";

import { OwnerReceptionistsManager } from "@/components/dashboard/owner-receptionists-manager";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { requireOwnerPage } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listClinicOptionsForReceptionists,
  listOwnerReceptionists,
} from "@/services/owner-receptionists";

import type { OwnerReceptionist } from "@/types/owner";

async function OwnerReceptionistsContent() {
  await requireOwnerPage("/owner/receptionists");

  let receptionists: OwnerReceptionist[] | null = null;
  let clinics: Array<{ id: string; name: string; isActive: boolean }> = [];
  try {
    const adminClient = createAdminClient();
    [receptionists, clinics] = await Promise.all([
      listOwnerReceptionists(adminClient),
      listClinicOptionsForReceptionists(adminClient),
    ]);
  } catch {
    receptionists = null;
  }

  if (!receptionists) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader
          title="موظفي الاستقبال"
          description="أضف حسابات موظفي الاستقبال واربط كل موظف بعيادته أو عدّل بياناته."
        />
        <ErrorState
          title="مش قادرين نحمّل حسابات موظفي الاستقبال دلوقتي"
          description="حصلت مشكلة في تحميل البيانات، حدّث الصفحة وحاول تاني."
        />
      </div>
    );
  }

  return (
    <OwnerReceptionistsManager
      initialReceptionists={receptionists}
      clinics={clinics}
    />
  );
}

function OwnerReceptionistsFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <LoadingState
        title="بنحمّل حسابات موظفي الاستقبال..."
        description="استنى لحظة وهتظهر كل الحسابات والعيادات."
      />
    </div>
  );
}

export default function OwnerReceptionistsPage() {
  return (
    <React.Suspense fallback={<OwnerReceptionistsFallback />}>
      <OwnerReceptionistsContent />
    </React.Suspense>
  );
}
