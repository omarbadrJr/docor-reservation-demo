import * as React from "react";

import { ReceptionistAppointmentsView } from "@/components/dashboard/receptionist-appointments-view";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { requireReceptionistPage } from "@/lib/auth/guards";
import { getCairoNow } from "@/lib/cairo-time";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ReceptionistServiceError,
  assertReceptionistClinic,
  listReceptionistAppointments,
  listReceptionistClinicDoctors,
} from "@/services/receptionist-appointments";
import type {
  ReceptionistAppointment,
  ReceptionistDoctorOption,
} from "@/types/receptionist";

const DEFAULT_LOAD_ERROR =
  "مقدرناش نحمّل حجوزات العيادة دلوقتي، حاول تاني بعد شوية.";

function ReceptionistAppointmentsLoadingFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <LoadingState
        title="بنحمّل حجوزات العيادة..."
        description="استنى لحظة وبنجيب لك كل الحجوزات والدكاترة."
      />
    </div>
  );
}

async function ReceptionistAppointmentsContent() {
  const staff = await requireReceptionistPage("/receptionist/appointments");
  const clinicId = assertReceptionistClinic(staff);
  const clinicName = staff.clinicName?.trim() || "العيادة المعينة";
  const todayDate = getCairoNow().date;

  let appointments: ReceptionistAppointment[] = [];
  let doctors: ReceptionistDoctorOption[] = [];
  let loadError: string | null = null;

  try {
    const adminClient = createAdminClient();
    [appointments, doctors] = await Promise.all([
      listReceptionistAppointments(adminClient, clinicId),
      listReceptionistClinicDoctors(adminClient, clinicId),
    ]);
  } catch (error) {
    loadError =
      error instanceof ReceptionistServiceError
        ? error.message
        : DEFAULT_LOAD_ERROR;
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader
          title="كل حجوزات العيادة"
          description="دوّر برقم الحجز أو الموبايل أو فلتر بالدكتور والتاريخ."
        />
        <ErrorState
          title="مقدرناش نحمّل الحجوزات"
          description={loadError}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <ReceptionistAppointmentsView
        initialAppointments={appointments}
        doctors={doctors}
        clinicName={clinicName}
        initialTodayDate={todayDate}
      />
    </div>
  );
}

export default function ReceptionistAppointmentsPage() {
  return (
    <React.Suspense fallback={<ReceptionistAppointmentsLoadingFallback />}>
      <ReceptionistAppointmentsContent />
    </React.Suspense>
  );
}
