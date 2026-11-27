import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { Building2 } from "lucide-react";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import HomePage from "@/app/(patient)/page";
import { BookingConfirmation } from "@/components/booking/booking-confirmation";
import { BookingDatePicker } from "@/components/booking/booking-date-picker";
import { BookingLookupForm } from "@/components/booking/booking-lookup-form";
import { BookingPatientForm } from "@/components/booking/booking-patient-form";
import { BookingSlotPicker } from "@/components/booking/booking-slot-picker";
import {
  CancelBookingDialogContent,
  ManagedBookingDetails,
} from "@/components/booking/managed-booking-details";
import { RescheduleBookingPanel } from "@/components/booking/reschedule-booking-panel";
import { OwnerOverview } from "@/components/dashboard/owner-overview";
import { ReceptionistAppointmentCard } from "@/components/dashboard/receptionist-appointment-card";
import { DoctorCard } from "@/components/doctors/doctor-card";
import { DoctorProfile } from "@/components/doctors/doctor-profile";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PatientShell } from "@/components/layout/patient-shell";
import { Dialog } from "@/components/ui/dialog";
import {
  AvailabilityStatusBadge,
  BookingStatusBadge,
  type AvailabilityStatus,
} from "@/components/ui/status-badge";
import type {
  BookingConfirmationData,
  ManagedBookingData,
} from "@/types/booking";
import type { DoctorCardData, DoctorProfileData } from "@/types/catalog";
import type { AppointmentStatus } from "@/types/database";
import type { OwnerDashboardOverview } from "@/types/owner";
import type { ReceptionistAppointment } from "@/types/receptionist";

const noop = () => {};
const noopAsync = async () => {};

const mockRouter: AppRouterInstance = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
  bfcacheId: "qa-bfcache-id",
};

function renderWithAppContext(
  element: ReactElement,
  pathname = "/",
): string {
  const captured: string[] = [];
  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: unknown[]) => {
    captured.push(`error: ${args.map(String).join(" ")}`);
  };
  console.warn = (...args: unknown[]) => {
    captured.push(`warn: ${args.map(String).join(" ")}`);
  };

  let html = "";
  try {
    html = renderToStaticMarkup(
      <AppRouterContext.Provider value={mockRouter}>
        <PathnameContext.Provider value={pathname}>
          {element}
        </PathnameContext.Provider>
      </AppRouterContext.Provider>,
    );
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }

  assert.deepEqual(
    captured,
    [],
    `Expected zero React SSR warnings/errors, got: ${captured.join(" | ")}`,
  );

  return html;
}

const SAMPLE_DOCTOR_CARD: DoctorCardData = {
  id: "33000000-0000-0000-0000-000000000001",
  fullName: "د. أحمد مصطفى",
  specialtyName: "باطنة",
  bio: "استشاري أمراض الباطنة والسكر",
  clinicName: "عيادة النيل التخصصية",
  clinicAddress: "شارع الجمهورية، دمنهور، البحيرة",
  consultationFee: "200.00",
  photoUrl: null,
};

const SAMPLE_DOCTOR_PROFILE: DoctorProfileData = {
  ...SAMPLE_DOCTOR_CARD,
  qualifications: "دكتوراه الباطنة العامة",
  experienceYears: 12,
  workingSchedule: [
    { day_of_week: 0, start_time: "09:00:00", end_time: "17:00:00" },
  ],
};

const SAMPLE_CONFIRMATION: BookingConfirmationData = {
  id: "44000000-0000-0000-0000-000000000001",
  referenceNumber: "DR-8K29P4",
  status: "CONFIRMED",
  patientName: "محمود علي حسن",
  patientPhone: "01012345678",
  doctorId: SAMPLE_DOCTOR_CARD.id,
  doctorName: SAMPLE_DOCTOR_CARD.fullName,
  specialtyName: SAMPLE_DOCTOR_CARD.specialtyName,
  clinicName: SAMPLE_DOCTOR_CARD.clinicName,
  clinicAddress: SAMPLE_DOCTOR_CARD.clinicAddress,
  consultationFee: SAMPLE_DOCTOR_CARD.consultationFee,
  appointmentDate: "2026-12-06",
  startTime: "09:00",
  endTime: "09:30",
  qrCodeDataUrl:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
};

const SAMPLE_MANAGED: ManagedBookingData = {
  ...SAMPLE_CONFIRMATION,
  isDoctorActive: true,
  isPast: false,
  canReschedule: true,
  canCancel: true,
};

const SAMPLE_RECEPTIONIST_APPOINTMENT: ReceptionistAppointment = {
  id: SAMPLE_CONFIRMATION.id,
  referenceNumber: SAMPLE_CONFIRMATION.referenceNumber,
  doctorId: SAMPLE_CONFIRMATION.doctorId,
  doctorName: SAMPLE_CONFIRMATION.doctorName,
  doctorIsActive: true,
  specialtyName: SAMPLE_CONFIRMATION.specialtyName,
  clinicId: "11000000-0000-0000-0000-000000000001",
  clinicName: SAMPLE_CONFIRMATION.clinicName,
  patientName: SAMPLE_CONFIRMATION.patientName,
  patientPhone: SAMPLE_CONFIRMATION.patientPhone,
  appointmentDate: SAMPLE_CONFIRMATION.appointmentDate,
  startTime: SAMPLE_CONFIRMATION.startTime,
  endTime: SAMPLE_CONFIRMATION.endTime,
  status: "CONFIRMED",
  createdAt: "2026-12-01T10:00:00Z",
};

const SAMPLE_OVERVIEW: OwnerDashboardOverview = {
  todayDate: "2026-12-06",
  counts: {
    clinicsTotal: 2,
    clinicsActive: 2,
    specialtiesTotal: 4,
    specialtiesActive: 4,
    doctorsTotal: 6,
    doctorsActive: 5,
    receptionistsTotal: 2,
    receptionistsActive: 2,
    todayAppointments: 1,
    upcomingAppointments: 1,
  },
  todayAppointments: [],
  upcomingAppointments: [],
};

describe("Phase 11 QA: RTL, Canonical Egyptian Arabic Copy & Accessibility", () => {
  it("enforces lang='ar' and dir='rtl' on the root HTML layout", () => {
    const layoutSource = fs.readFileSync(
      path.join(process.cwd(), "src/app/layout.tsx"),
      "utf8",
    );
    assert.match(layoutSource, /lang="ar"/);
    assert.match(layoutSource, /dir="rtl"/);
  });

  it("renders all 12 canonical Egyptian Arabic labels across patient and staff surfaces without warnings", () => {
    const homeHtml = renderWithAppContext(<HomePage />);
    assert.match(homeHtml, /عايز تكشف عند دكتور إيه؟/);
    assert.match(homeHtml, /احجز عند دكتور/);
    assert.match(homeHtml, /عندي حجز بالفعل/);
    assert.match(homeHtml, /اختار التخصص/);
    assert.match(homeHtml, /أكّد الحجز/);

    const profileHtml = renderWithAppContext(
      <DoctorProfile doctor={SAMPLE_DOCTOR_PROFILE} />,
    );
    assert.match(profileHtml, /المواعيد المتاحة/);
    assert.match(profileHtml, /عنوان العيادة/);

    const slotsHtml = renderWithAppContext(
      <BookingSlotPicker
        selectedDate="2026-12-06"
        availability={{
          date: "2026-12-06",
          state: "AVAILABLE",
          slots: [{ start: "09:00", end: "09:30" }],
        }}
        selectedSlot={null}
        isLoading={false}
        error={null}
        onSelectSlot={noop}
        onRetry={noop}
      />,
    );
    assert.match(slotsHtml, /المواعيد المتاحة/);

    const formHtml = renderWithAppContext(
      <BookingPatientForm
        selectedDate="2026-12-06"
        selectedSlot={{ start: "09:00", end: "09:30" }}
        serverError={null}
        isSubmitting={false}
        onSubmit={noopAsync}
      />,
    );
    assert.match(formHtml, /أكّد الحجز/);

    const confirmationHtml = renderWithAppContext(
      <BookingConfirmation booking={SAMPLE_CONFIRMATION} />,
    );
    assert.match(confirmationHtml, /رقم الحجز/);
    assert.match(confirmationHtml, /عنوان العيادة/);
    assert.match(confirmationHtml, /عندي حجز بالفعل/);

    const managedHtml = renderWithAppContext(
      <ManagedBookingDetails
        booking={SAMPLE_MANAGED}
        onStartReschedule={noop}
        onCancelDialogOpenChange={noop}
        onConfirmCancel={noop}
      />,
    );
    assert.match(managedHtml, /غيّر معادك/);
    assert.match(managedHtml, /إلغاء الحجز/);

    const cancelDialogHtml = renderWithAppContext(
      <Dialog open={true}>
        <CancelBookingDialogContent
          booking={SAMPLE_MANAGED}
          isCancelling={false}
          error={null}
          onConfirmCancel={noop}
        />
      </Dialog>,
    );
    assert.match(cancelDialogHtml, /متأكد إنك عايز تلغي الحجز؟/);

    const receptionistCardHtml = renderWithAppContext(
      <ReceptionistAppointmentCard
        appointment={SAMPLE_RECEPTIONIST_APPOINTMENT}
        onCheckIn={noop}
      />,
    );
    assert.match(receptionistCardHtml, /تسجيل وصول المريض/);

    renderWithAppContext(<DoctorCard doctor={SAMPLE_DOCTOR_CARD} />);
  });

  it("wraps phone numbers and booking references in dir='ltr' inside RTL UI", () => {
    const lookupHtml = renderWithAppContext(
      <BookingLookupForm
        mode="phone"
        value="01012345678"
        isLoading={false}
        error={null}
        onModeChange={noop}
        onValueChange={noop}
        onSubmit={noop}
      />,
    );
    assert.match(lookupHtml, /dir="ltr"/);

    const formHtml = renderWithAppContext(
      <BookingPatientForm
        selectedDate="2026-12-06"
        selectedSlot={{ start: "09:00", end: "09:30" }}
        serverError={null}
        isSubmitting={false}
        onSubmit={noopAsync}
      />,
    );
    assert.match(formHtml, /name="patientPhone"[^>]*dir="ltr"|dir="ltr"[^>]*name="patientPhone"/);

    const confirmationHtml = renderWithAppContext(
      <BookingConfirmation booking={SAMPLE_CONFIRMATION} />,
    );
    assert.match(confirmationHtml, /dir="ltr"[^>]*>DR-8K29P4<\/p>/);
    assert.match(confirmationHtml, /dir="ltr"[^>]*>01012345678<\/dd>/);

    const rescheduleHtml = renderWithAppContext(
      <RescheduleBookingPanel
        booking={SAMPLE_MANAGED}
        todayDate="2026-12-05"
        initialMonth="2026-12"
        initialDates={[{ date: "2026-12-06", state: "AVAILABLE" }]}
        initialSelectedDate="2026-12-06"
        initialAvailability={{
          date: "2026-12-06",
          state: "AVAILABLE",
          slots: [{ start: "09:30", end: "10:00" }],
        }}
        onCancelReschedule={noop}
        onRescheduled={noop}
      />,
    );
    assert.match(rescheduleHtml, /dir="ltr"[^>]*>DR-8K29P4<\/span>/);

    const receptionistHtml = renderWithAppContext(
      <ReceptionistAppointmentCard
        appointment={SAMPLE_RECEPTIONIST_APPOINTMENT}
      />,
    );
    assert.match(receptionistHtml, /dir="ltr"[^>]*>DR-8K29P4<\/span>/);
    assert.match(receptionistHtml, /dir="ltr"[^>]*>01012345678<\/dd>/);
  });

  it("never conveys booking or availability status by color alone (always pairs icon + Arabic text)", () => {
    const bookingStatuses: AppointmentStatus[] = [
      "CONFIRMED",
      "CHECKED_IN",
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
    ];
    for (const status of bookingStatuses) {
      const html = renderToStaticMarkup(<BookingStatusBadge status={status} />);
      assert.match(html, /<svg[^>]*aria-hidden="true"/);
      assert.match(html, /[\u0600-\u06FF]+/);
    }

    const availabilityStatuses: AvailabilityStatus[] = [
      "AVAILABLE",
      "FULL",
      "OFF",
    ];
    for (const status of availabilityStatuses) {
      const html = renderToStaticMarkup(
        <AvailabilityStatusBadge status={status} />,
      );
      assert.match(html, /<svg[^>]*aria-hidden="true"/);
      assert.match(html, /[\u0600-\u06FF]+/);
    }
  });

  it("uses design-ramp text-xs and 44px+ touch targets on shells, date picker, and owner overview links", () => {
    const patientShellHtml = renderWithAppContext(
      <PatientShell>
        <div>محتوى</div>
      </PatientShell>,
      "/",
    );
    assert.doesNotMatch(patientShellHtml, /text-\[0\.7rem\]/);
    assert.match(patientShellHtml, /text-xs/);

    const dashboardShellHtml = renderWithAppContext(
      <DashboardShell
        title="لوحة التحكم"
        subtitle="إدارة العيادات"
        navItems={[{ href: "/owner", label: "الرئيسية", icon: Building2, exact: true }]}
        userLabel="د. خالد"
        roleLabel="صاحب المنصة"
      >
        <div>محتوى</div>
      </DashboardShell>,
      "/owner",
    );
    assert.doesNotMatch(dashboardShellHtml, /text-\[0\.7rem\]/);
    assert.match(dashboardShellHtml, /text-xs/);

    const datePickerHtml = renderWithAppContext(
      <BookingDatePicker
        month="2026-12"
        minMonth="2026-12"
        todayDate="2026-12-03"
        dates={[
          { date: "2026-12-01", state: "FULL" },
          { date: "2026-12-03", state: "AVAILABLE" },
          { date: "2026-12-04", state: "FULL" },
          { date: "2026-12-05", state: "OFF" },
        ]}
        selectedDate="2026-12-03"
        isLoading={false}
        error={null}
        onSelectDate={noop}
        onChangeMonth={noop}
        onRetry={noop}
      />,
    );
    assert.doesNotMatch(datePickerHtml, /text-\[11px\]/);
    assert.match(datePickerHtml, /min-h-14/);
    assert.match(datePickerHtml, /aria-pressed="true"/);

    const ownerOverviewHtml = renderWithAppContext(
      <OwnerOverview overview={SAMPLE_OVERVIEW} />,
    );
    assert.match(ownerOverviewHtml, /عرض كل الحجوزات/);
    assert.match(ownerOverviewHtml, /h-11/);
    assert.doesNotMatch(ownerOverviewHtml, /h-9/);
  });
});
