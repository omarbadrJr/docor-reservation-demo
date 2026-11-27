import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type {
  ReceptionistAppointment,
  ReceptionistDoctorOption,
  ReceptionistTodayDashboard,
} from "@/types/receptionist";

import { ReceptionistAppointmentCard } from "./receptionist-appointment-card";
import { ReceptionistAppointmentsView } from "./receptionist-appointments-view";
import { ReceptionistCheckInView } from "./receptionist-check-in-view";
import { ReceptionistTodayView } from "./receptionist-today-view";

const mockRouter: AppRouterInstance = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
  bfcacheId: "test-bfcache-id",
};

function renderWithoutWarnings(element: ReactElement): string {
  const captured: string[] = [];
  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: unknown[]) => {
    captured.push(`error: ${args.map(String).join(" ")}`);
  };
  console.warn = (...args: unknown[]) => {
    captured.push(`warn: ${args.map(String).join(" ")}`);
  };

  let html: string;
  try {
    html = renderToStaticMarkup(
      <AppRouterContext.Provider value={mockRouter}>
        {element}
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

const CLINIC_ID = "11000000-0000-0000-0000-000000000001";
const CLINIC_NAME = "عيادة النيل التخصصية";

const CONFIRMED_APPOINTMENT: ReceptionistAppointment = {
  id: "44000000-0000-0000-0000-000000000001",
  referenceNumber: "DR-8K29P4",
  doctorId: "33000000-0000-0000-0000-000000000001",
  doctorName: "د. أحمد مصطفى",
  doctorIsActive: true,
  specialtyName: "باطنة",
  clinicId: CLINIC_ID,
  clinicName: CLINIC_NAME,
  patientName: "سارة محمود علي",
  patientPhone: "01012345678",
  appointmentDate: "2026-12-06",
  startTime: "09:00",
  endTime: "09:30",
  status: "CONFIRMED",
  createdAt: "2026-12-01T10:00:00Z",
};

const CANCELLED_APPOINTMENT: ReceptionistAppointment = {
  id: "44000000-0000-0000-0000-000000000002",
  referenceNumber: "DR-CANC01",
  doctorId: "33000000-0000-0000-0000-000000000002",
  doctorName: "د. سارة عباس",
  doctorIsActive: false,
  specialtyName: "أطفال",
  clinicId: CLINIC_ID,
  clinicName: CLINIC_NAME,
  patientName: "خالد حسن",
  patientPhone: "01122334455",
  appointmentDate: "2026-12-06",
  startTime: "13:00",
  endTime: "13:30",
  status: "CANCELLED",
  createdAt: "2026-12-01T11:00:00Z",
};

const DOCTORS: ReceptionistDoctorOption[] = [
  {
    id: CONFIRMED_APPOINTMENT.doctorId,
    fullName: CONFIRMED_APPOINTMENT.doctorName,
    specialtyName: "باطنة",
    isActive: true,
  },
  {
    id: CANCELLED_APPOINTMENT.doctorId,
    fullName: CANCELLED_APPOINTMENT.doctorName,
    specialtyName: "أطفال",
    isActive: false,
  },
];

describe("ReceptionistAppointmentCard", () => {
  it("renders canonical check-in button on CONFIRMED appointments without warnings", () => {
    const html = renderWithoutWarnings(
      <ReceptionistAppointmentCard
        appointment={CONFIRMED_APPOINTMENT}
        onCheckIn={() => {}}
        onUpdateStatus={() => {}}
      />,
    );

    assert.match(html, /سارة محمود علي/);
    assert.match(html, /dir="ltr"[^>]*>DR-8K29P4/);
    assert.match(html, /dir="ltr"[^>]*>01012345678/);
    assert.match(html, /تسجيل وصول المريض/);
    assert.match(html, /ما حضرش/);
    assert.match(html, /9:00 الصبح - 9:30 الصبح/);
  });

  it("blocks check-in button and shows cancellation notice on CANCELLED appointments", () => {
    const html = renderWithoutWarnings(
      <ReceptionistAppointmentCard
        appointment={CANCELLED_APPOINTMENT}
        onCheckIn={() => {}}
        onUpdateStatus={() => {}}
      />,
    );

    assert.match(html, /دكتور غير نشط/);
    assert.match(html, /الحجز ده ملغي وما ينفعش تسجّل وصول المريض\./);
    assert.doesNotMatch(html, />تسجيل وصول المريض</);
  });
});

describe("ReceptionistTodayView", () => {
  it("renders empty state when there are no appointments today", () => {
    const emptyDashboard: ReceptionistTodayDashboard = {
      todayDate: "2026-12-06",
      clinicId: CLINIC_ID,
      clinicName: CLINIC_NAME,
      counts: {
        total: 0,
        confirmed: 0,
        checkedIn: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
      },
      appointments: [],
      doctors: DOCTORS,
    };

    const html = renderWithoutWarnings(
      <ReceptionistTodayView initialDashboard={emptyDashboard} />,
    );

    assert.match(html, /مواعيد النهارده/);
    assert.match(html, /مفيش حجوزات النهارده/);
    assert.match(html, /href="\/receptionist\/check-in"/);
    assert.match(html, /href="\/receptionist\/appointments"/);
  });

  it("renders populated today dashboard with metrics, filters, and action buttons", () => {
    const dashboard: ReceptionistTodayDashboard = {
      todayDate: "2026-12-06",
      clinicId: CLINIC_ID,
      clinicName: CLINIC_NAME,
      counts: {
        total: 1,
        confirmed: 1,
        checkedIn: 0,
        completed: 0,
        cancelled: 1,
        noShow: 0,
      },
      appointments: [CONFIRMED_APPOINTMENT, CANCELLED_APPOINTMENT],
      doctors: DOCTORS,
    };

    const html = renderWithoutWarnings(
      <ReceptionistTodayView initialDashboard={dashboard} />,
    );

    assert.match(html, /عيادة النيل التخصصية/);
    assert.match(html, /الأحد، 6 ديسمبر 2026/);
    assert.match(html, /سارة محمود علي/);
    assert.match(html, /خالد حسن/);
    assert.match(html, /تسجيل وصول المريض/);
    assert.match(html, /معروض 2 من 2 حجز/);
  });
});

describe("ReceptionistAppointmentsView", () => {
  it("renders empty state and clinic-scoped filter controls", () => {
    const html = renderWithoutWarnings(
      <ReceptionistAppointmentsView
        initialAppointments={[]}
        doctors={DOCTORS}
        clinicName={CLINIC_NAME}
        initialTodayDate="2026-12-06"
      />,
    );

    assert.match(html, /كل حجوزات العيادة/);
    assert.match(html, /id="receptionist-appointments-query"/);
    assert.match(html, /حجوزات النهارده/);
    assert.match(html, /لسه مفيش حجوزات في العيادة/);
    assert.doesNotMatch(html, /كل العيادات/);
  });

  it("renders populated appointments list with check-in links", () => {
    const html = renderWithoutWarnings(
      <ReceptionistAppointmentsView
        initialAppointments={[CONFIRMED_APPOINTMENT, CANCELLED_APPOINTMENT]}
        doctors={DOCTORS}
        clinicName={CLINIC_NAME}
        initialTodayDate="2026-12-06"
      />,
    );

    assert.match(html, /إجمالي 2 حجز/);
    assert.match(html, /DR-8K29P4/);
    assert.match(html, /DR-CANC01/);
    assert.match(html, /فتح في شاشة الوصول/);
  });
});

describe("ReceptionistCheckInView", () => {
  it("renders idle lookup form and QR camera scanner trigger", () => {
    const html = renderWithoutWarnings(
      <ReceptionistCheckInView clinicName={CLINIC_NAME} />,
    );

    assert.match(html, /تسجيل وصول المريض/);
    assert.match(html, /id="receptionist-checkin-code"/);
    assert.match(html, /بحث عن الحجز/);
    assert.match(html, /مسح كود QR بالكاميرا/);
    assert.match(html, /جاهز لتسجيل وصول المريض/);
  });

  it("renders preloaded appointment details and lookup errors cleanly", () => {
    const foundHtml = renderWithoutWarnings(
      <ReceptionistCheckInView
        clinicName={CLINIC_NAME}
        initialReference="DR-8K29P4"
        initialAppointment={CONFIRMED_APPOINTMENT}
      />,
    );

    assert.match(foundHtml, /بيانات الحجز/);
    assert.match(foundHtml, /سارة محمود علي/);
    assert.match(foundHtml, /تسجيل وصول المريض/);

    const errHtml = renderWithoutWarnings(
      <ReceptionistCheckInView
        clinicName={CLINIC_NAME}
        initialReference="DR-000000"
        initialError="الحجز ده مش موجود في عيادتك."
      />,
    );

    assert.match(errHtml, /الحجز ده مش موجود في عيادتك\./);
  });
});
