import * as React from "react";

import { ReceptionistCheckInView } from "@/components/dashboard/receptionist-check-in-view";
import { LoadingState } from "@/components/ui/state";
import { requireReceptionistPage } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseReceptionistReferenceParam } from "@/lib/validations/receptionist";
import {
  ReceptionistServiceError,
  assertReceptionistClinic,
  getReceptionistAppointmentByReference,
} from "@/services/receptionist-appointments";
import type { ReceptionistAppointment } from "@/types/receptionist";

const DEFAULT_LOOKUP_ERROR =
  "مقدرناش نجيب بيانات الحجز دلوقتي، حاول تاني بعد شوية.";

function ReceptionistCheckInLoadingFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <LoadingState
        title="بنجهّز شاشة تسجيل الوصول..."
        description="استنى لحظة وبنفتح لك شاشة البحث ومسح الكود."
      />
    </div>
  );
}

async function ReceptionistCheckInContent({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string | string[] }>;
}) {
  const staff = await requireReceptionistPage("/receptionist/check-in");
  const clinicId = assertReceptionistClinic(staff);
  const clinicName = staff.clinicName?.trim() || "العيادة المعينة";

  const params = await searchParams;
  const rawReference =
    typeof params.reference === "string"
      ? params.reference
      : Array.isArray(params.reference)
        ? params.reference[0]
        : undefined;

  let initialReference = "";
  let initialAppointment: ReceptionistAppointment | null = null;
  let initialError: string | null = null;

  if (rawReference && rawReference.trim().length > 0) {
    const parsedRef = parseReceptionistReferenceParam(rawReference);
    if (!parsedRef.success) {
      initialReference = rawReference.trim();
      initialError = parsedRef.message;
    } else {
      initialReference = parsedRef.reference;
      try {
        initialAppointment = await getReceptionistAppointmentByReference(
          createAdminClient(),
          clinicId,
          parsedRef.reference,
        );
      } catch (error) {
        initialError =
          error instanceof ReceptionistServiceError
            ? error.message
            : DEFAULT_LOOKUP_ERROR;
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <ReceptionistCheckInView
        clinicName={clinicName}
        initialReference={initialReference}
        initialAppointment={initialAppointment}
        initialError={initialError}
      />
    </div>
  );
}

export default function ReceptionistCheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string | string[] }>;
}) {
  return (
    <React.Suspense fallback={<ReceptionistCheckInLoadingFallback />}>
      <ReceptionistCheckInContent searchParams={searchParams} />
    </React.Suspense>
  );
}
