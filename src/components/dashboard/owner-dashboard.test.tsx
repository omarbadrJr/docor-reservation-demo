import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type {
  OwnerAppointmentClinicOption,
  OwnerAppointmentDoctorOption,
} from "@/services/owner-appointments";
import type { OwnerDoctorFormOptions } from "@/services/owner-doctors";
import type {
  OwnerAppointment,
  OwnerClinic,
  OwnerDashboardOverview,
  OwnerDoctor,
  OwnerDoctorSchedules,
  OwnerReceptionist,
  OwnerSpecialty,
} from "@/types/owner";

import { ActiveStatusBadge } from "./active-status-badge";
import { OwnerAppointmentsView } from "./owner-appointments-view";
import { OwnerClinicsManager } from "./owner-clinics-manager";
import { OwnerDoctorScheduleManager } from "./owner-doctor-schedule-manager";
import { OwnerDoctorsManager } from "./owner-doctors-manager";
import { OwnerOverview } from "./owner-overview";
import { OwnerReceptionistsManager } from "./owner-receptionists-manager";
import { OwnerSpecialtiesManager } from "./owner-specialties-manager";

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

const CLINIC_ACTIVE: OwnerClinic = {
  id: "11000000-0000-0000-0000-000000000001",
  name: "عيادة النيل التخصصية",
  address: "شارع الجمهورية، دمنهور، البحيرة",
  phone: "0453311223",
  isActive: true,
  doctorCount: 3,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const CLINIC_INACTIVE: OwnerClinic = {
  id: "11000000-0000-0000-0000-000000000002",
  name: "عيادة السلام القديمة",
  address: "ميدان الساعة، كفر الدوار، البحيرة",
  phone: "0452299887",
  isActive: false,
  doctorCount: 1,
  createdAt: "2026-01-02T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
};

const SPECIALTY_ACTIVE: OwnerSpecialty = {
  id: "22000000-0000-0000-0000-000000000001",
  name: "باطنة",
  description: "متابعة الضغط والسكر وأمراض الجهاز الهضمي",
  isActive: true,
  doctorCount: 2,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const SPECIALTY_INACTIVE: OwnerSpecialty = {
  id: "22000000-0000-0000-0000-000000000002",
  name: "جراحة عامة",
  description: null,
  isActive: false,
  doctorCount: 0,
  createdAt: "2026-01-02T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
};

const DOCTOR_ACTIVE: OwnerDoctor = {
  id: "33000000-0000-0000-0000-000000000001",
  fullName: "د. أحمد مصطفى",
  clinicId: CLINIC_ACTIVE.id,
  clinicName: CLINIC_ACTIVE.name,
  clinicIsActive: true,
  specialtyId: SPECIALTY_ACTIVE.id,
  specialtyName: SPECIALTY_ACTIVE.name,
  specialtyIsActive: true,
  photoUrl: "/doctors/demo-portrait.svg",
  bio: "استشاري أمراض الباطنة والسكر بخبرة طويلة في متابعة الحالات المزمنة.",
  qualifications: "دكتوراه أمراض الباطنة العامة",
  experienceYears: 12,
  consultationFee: "250.00",
  slotDurationMinutes: 30,
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const DOCTOR_INACTIVE: OwnerDoctor = {
  id: "33000000-0000-0000-0000-000000000002",
  fullName: "د. سارة عباس",
  clinicId: CLINIC_INACTIVE.id,
  clinicName: CLINIC_INACTIVE.name,
  clinicIsActive: false,
  specialtyId: SPECIALTY_INACTIVE.id,
  specialtyName: SPECIALTY_INACTIVE.name,
  specialtyIsActive: false,
  photoUrl: null,
  bio: null,
  qualifications: null,
  experienceYears: null,
  consultationFee: "150.00",
  slotDurationMinutes: 20,
  isActive: false,
  createdAt: "2026-01-02T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
};

const DOCTOR_FORM_OPTIONS: OwnerDoctorFormOptions = {
  clinics: [
    { id: CLINIC_ACTIVE.id, name: CLINIC_ACTIVE.name, isActive: true },
    { id: CLINIC_INACTIVE.id, name: CLINIC_INACTIVE.name, isActive: false },
  ],
  specialties: [
    { id: SPECIALTY_ACTIVE.id, name: SPECIALTY_ACTIVE.name, isActive: true },
    {
      id: SPECIALTY_INACTIVE.id,
      name: SPECIALTY_INACTIVE.name,
      isActive: false,
    },
  ],
};

const APPOINTMENT_TODAY_ACTIVE: OwnerAppointment = {
  id: "44000000-0000-0000-0000-000000000001",
  referenceNumber: "DR-8K29P4",
  doctorId: DOCTOR_ACTIVE.id,
  doctorName: DOCTOR_ACTIVE.fullName,
  doctorIsActive: true,
  clinicId: CLINIC_ACTIVE.id,
  clinicName: CLINIC_ACTIVE.name,
  clinicIsActive: true,
  specialtyName: SPECIALTY_ACTIVE.name,
  patientName: "سارة محمود علي",
  patientPhone: "01012345678",
  appointmentDate: "2026-12-06",
  startTime: "09:00",
  endTime: "09:30",
  status: "CONFIRMED",
  createdAt: "2026-12-01T10:00:00Z",
};

const APPOINTMENT_INACTIVE_DOCTOR: OwnerAppointment = {
  id: "44000000-0000-0000-0000-000000000002",
  referenceNumber: "DR-5T43W1",
  doctorId: DOCTOR_INACTIVE.id,
  doctorName: DOCTOR_INACTIVE.fullName,
  doctorIsActive: false,
  clinicId: CLINIC_ACTIVE.id,
  clinicName: CLINIC_ACTIVE.name,
  clinicIsActive: true,
  specialtyName: SPECIALTY_ACTIVE.name,
  patientName: "محمد حسن إبراهيم",
  patientPhone: "01122334455",
  appointmentDate: "2026-12-07",
  startTime: "13:00",
  endTime: "13:30",
  status: "COMPLETED",
  createdAt: "2026-12-01T11:00:00Z",
};

const APPOINTMENT_INACTIVE_CLINIC: OwnerAppointment = {
  id: "44000000-0000-0000-0000-000000000003",
  referenceNumber: "DR-9M12Q7",
  doctorId: DOCTOR_ACTIVE.id,
  doctorName: DOCTOR_ACTIVE.fullName,
  doctorIsActive: true,
  clinicId: CLINIC_INACTIVE.id,
  clinicName: CLINIC_INACTIVE.name,
  clinicIsActive: false,
  specialtyName: SPECIALTY_INACTIVE.name,
  patientName: "هبة عبد الله",
  patientPhone: "01233445566",
  appointmentDate: "2026-12-08",
  startTime: "18:00",
  endTime: "18:30",
  status: "CHECKED_IN",
  createdAt: "2026-12-01T12:00:00Z",
};

describe("ActiveStatusBadge", () => {
  it("renders active badge with saffron signal token, icon, and Arabic label without warnings", () => {
    const html = renderWithoutWarnings(<ActiveStatusBadge isActive />);

    assert.match(html, /data-slot="badge"/);
    assert.match(html, /<svg\b[^>]*aria-hidden="true"/);
    assert.match(html, /bg-primary/);
    assert.doesNotMatch(html, /emerald/);
    assert.match(html, /نشط/);
    assert.doesNotMatch(html, /غير نشط/);
  });

  it("renders inactive badge with icon and Arabic label without warnings", () => {
    const html = renderWithoutWarnings(<ActiveStatusBadge isActive={false} />);

    assert.match(html, /data-slot="badge"/);
    assert.match(html, /<svg\b[^>]*aria-hidden="true"/);
    assert.match(html, /غير نشط/);
  });
});

describe("OwnerOverview", () => {
  it("renders empty states, zero counts, and all 5 owner section links", () => {
    const emptyOverview: OwnerDashboardOverview = {
      todayDate: "2026-12-06",
      counts: {
        clinicsTotal: 0,
        clinicsActive: 0,
        specialtiesTotal: 0,
        specialtiesActive: 0,
        doctorsTotal: 0,
        doctorsActive: 0,
        receptionistsTotal: 0,
        receptionistsActive: 0,
        todayAppointments: 0,
        upcomingAppointments: 0,
      },
      todayAppointments: [],
      upcomingAppointments: [],
    };

    const html = renderWithoutWarnings(
      <OwnerOverview overview={emptyOverview} />,
    );

    assert.match(html, /نظرة عامة/);
    assert.match(html, /الأحد، 6 ديسمبر 2026/);
    assert.match(html, /مفيش حجوزات النهارده/);
    assert.match(html, /مفيش حجوزات جاية دلوقتي/);
    assert.match(html, /href="\/owner\/clinics"/);
    assert.match(html, /href="\/owner\/specialties"/);
    assert.match(html, /href="\/owner\/doctors"/);
    assert.match(html, /href="\/owner\/receptionists"/);
    assert.match(html, /href="\/owner\/appointments"/);
  });

  it("renders populated counts, today/upcoming slips, and inactive badges", () => {
    const populatedOverview: OwnerDashboardOverview = {
      todayDate: "2026-12-06",
      counts: {
        clinicsTotal: 4,
        clinicsActive: 3,
        specialtiesTotal: 6,
        specialtiesActive: 5,
        doctorsTotal: 10,
        doctorsActive: 8,
        receptionistsTotal: 5,
        receptionistsActive: 4,
        todayAppointments: 1,
        upcomingAppointments: 2,
      },
      todayAppointments: [APPOINTMENT_TODAY_ACTIVE],
      upcomingAppointments: [
        APPOINTMENT_INACTIVE_DOCTOR,
        APPOINTMENT_INACTIVE_CLINIC,
      ],
    };

    const html = renderWithoutWarnings(
      <OwnerOverview overview={populatedOverview} />,
    );

    assert.match(html, /نشطة من إجمالي 4/);
    assert.match(html, /نشط من إجمالي 6/);
    assert.match(html, /نشط من إجمالي 10/);
    assert.match(html, /نشط من إجمالي 5/);
    assert.match(html, /إجمالي 1 حجز/);
    assert.match(html, /إجمالي 2 حجز/);

    assert.match(html, /href="\/owner\/clinics"/);
    assert.match(html, /href="\/owner\/specialties"/);
    assert.match(html, /href="\/owner\/doctors"/);
    assert.match(html, /href="\/owner\/receptionists"/);
    assert.match(html, /href="\/owner\/appointments"/);

    assert.match(html, /سارة محمود علي/);
    assert.match(html, /محمد حسن إبراهيم/);
    assert.match(html, /هبة عبد الله/);
    assert.match(html, /dir="ltr"[^>]*>DR-8K29P4/);
    assert.match(html, /dir="ltr"[^>]*>01012345678/);
    assert.match(html, /مؤكد/);
    assert.match(html, /خلص/);
    assert.match(html, /وصل العيادة/);
    assert.match(html, /9:00 الصبح - 9:30 الصبح/);
    assert.match(html, /1:00 مساءً - 1:30 مساءً/);
    assert.match(html, /6:00 مساءً - 6:30 مساءً/);
    assert.match(html, /دكتور غير نشط/);
    assert.match(html, /عيادة غير نشطة/);
  });
});

describe("OwnerClinicsManager", () => {
  it("renders empty state when no clinics exist", () => {
    const html = renderWithoutWarnings(
      <OwnerClinicsManager initialClinics={[]} />,
    );

    assert.match(html, /العيادات/);
    assert.match(html, /إضافة عيادة جديدة/);
    assert.match(html, /لسه مفيش عيادات مسجلة/);
    assert.doesNotMatch(html, /id="clinics-search"/);
  });

  it("renders populated clinic cards with doctor counts, ltr phones, and toggle controls", () => {
    const html = renderWithoutWarnings(
      <OwnerClinicsManager
        initialClinics={[CLINIC_ACTIVE, CLINIC_INACTIVE]}
      />,
    );

    assert.match(html, /id="clinics-search"/);
    assert.match(html, /عيادة النيل التخصصية/);
    assert.match(html, /شارع الجمهورية، دمنهور، البحيرة/);
    assert.match(html, /عيادة السلام القديمة/);
    assert.match(html, /dir="ltr"[^>]*>0453311223/);
    assert.match(html, /dir="ltr"[^>]*>0452299887/);
    assert.match(html, /3 دكاترة/);
    assert.match(html, /دكتور واحد/);
    assert.match(html, /نشط/);
    assert.match(html, /غير نشط/);
    assert.match(html, /إضافة عيادة جديدة/);
    assert.match(html, /تعديل البيانات/);
    assert.match(html, /تعطيل العيادة/);
    assert.match(html, /تفعيل العيادة/);
    assert.match(html, /العيادة دي متعطلة دلوقتي/);
  });
});

describe("OwnerSpecialtiesManager", () => {
  it("renders empty state when no specialties exist", () => {
    const html = renderWithoutWarnings(
      <OwnerSpecialtiesManager initialSpecialties={[]} />,
    );

    assert.match(html, /التخصصات/);
    assert.match(html, /إضافة تخصص جديد/);
    assert.match(html, /لسه مفيش تخصصات مسجلة/);
    assert.doesNotMatch(html, /id="specialties-search"/);
  });

  it("renders populated specialty cards with descriptions, counts, and toggle actions", () => {
    const html = renderWithoutWarnings(
      <OwnerSpecialtiesManager
        initialSpecialties={[SPECIALTY_ACTIVE, SPECIALTY_INACTIVE]}
      />,
    );

    assert.match(html, /id="specialties-search"/);
    assert.match(html, /باطنة/);
    assert.match(html, /متابعة الضغط والسكر وأمراض الجهاز الهضمي/);
    assert.match(html, /دكتورين/);
    assert.match(html, /جراحة عامة/);
    assert.match(html, /مفيش وصف مضاف للتخصص ده\./);
    assert.match(html, /مفيش دكاترة مسجلين/);
    assert.match(html, /نشط/);
    assert.match(html, /غير نشط/);
    assert.match(html, /تعديل البيانات/);
    assert.match(html, /تعطيل التخصص/);
    assert.match(html, /تفعيل التخصص/);
  });
});

describe("OwnerDoctorsManager", () => {
  it("renders empty state when no doctors exist", () => {
    const html = renderWithoutWarnings(
      <OwnerDoctorsManager
        initialDoctors={[]}
        options={DOCTOR_FORM_OPTIONS}
      />,
    );

    assert.match(html, /الدكاترة/);
    assert.match(html, /إضافة دكتور جديد/);
    assert.match(html, /مفيش دكاترة متسجلين لسه/);
    assert.match(html, /<strong[^>]*>0<\/strong>/);
  });

  it("renders empty state cleanly even when clinic and specialty options are empty", () => {
    const html = renderWithoutWarnings(
      <OwnerDoctorsManager
        initialDoctors={[]}
        options={{ clinics: [], specialties: [] }}
      />,
    );

    assert.match(html, /الدكاترة/);
    assert.match(html, /إضافة دكتور جديد/);
    assert.match(html, /مفيش دكاترة متسجلين لسه/);
    assert.match(html, /كل العيادات/);
    assert.match(html, /كل التخصصات/);
  });

  it("renders populated doctor cards with fee, slot duration, inactive warnings, and schedule links", () => {
    const html = renderWithoutWarnings(
      <OwnerDoctorsManager
        initialDoctors={[DOCTOR_ACTIVE, DOCTOR_INACTIVE]}
        options={DOCTOR_FORM_OPTIONS}
      />,
    );

    assert.match(html, /د\. أحمد مصطفى/);
    assert.match(html, /د\. سارة عباس/);
    assert.match(html, /250 جنيه/);
    assert.match(html, /150 جنيه/);
    assert.match(html, /30 دقيقة/);
    assert.match(html, /20 دقيقة/);
    assert.match(html, /12 سنين خبرة/);
    assert.match(html, /غير محددة/);
    assert.match(html, /\(تخصص غير نشط\)/);
    assert.match(html, /\(عيادة غير نشطة\)/);
    assert.match(
      html,
      /الحجوزات الجديدة موقوفة والحجوزات السابقة لسه ظاهرة/,
    );
    assert.match(
      html,
      new RegExp(`href="/owner/doctors/${DOCTOR_ACTIVE.id}/schedule"`),
    );
    assert.match(
      html,
      new RegExp(`href="/owner/doctors/${DOCTOR_INACTIVE.id}/schedule"`),
    );
    assert.match(html, /المواعيد والجدول/);
    assert.match(html, /تعطيل/);
    assert.match(html, /تفعيل/);
  });
});

describe("OwnerDoctorScheduleManager", () => {
  it("renders all 3 schedule sections with empty states and inactive doctor notice", () => {
    const emptySchedules: OwnerDoctorSchedules = {
      doctor: {
        id: DOCTOR_INACTIVE.id,
        fullName: DOCTOR_INACTIVE.fullName,
        clinicName: CLINIC_INACTIVE.name,
        specialtyName: SPECIALTY_INACTIVE.name,
        slotDurationMinutes: 20,
        isActive: false,
      },
      weeklySchedules: [],
      manualAvailabilities: [],
      scheduleExceptions: [],
    };

    const html = renderWithoutWarnings(
      <OwnerDoctorScheduleManager initialData={emptySchedules} />,
    );

    assert.match(html, /href="\/owner\/doctors"/);
    assert.match(html, /مواعيد د\. سارة عباس/);
    assert.match(html, /20 دقيقة/);
    assert.match(html, /الدكتور ده غير نشط حالياً/);
    assert.match(html, /الجدول الأسبوعي الثابت/);
    assert.match(html, /مفيش فترات في الجدول الأسبوعي لسه/);
    assert.match(html, /مواعيد إضافية بتاريخ محدد/);
    assert.match(html, /مفيش مواعيد إضافية مسجلة/);
    assert.match(html, /استثناءات الجدول والإجازات/);
    assert.match(html, /مفيش استثناءات أو إجازات مسجلة/);
  });

  it("renders populated weekly, manual, and exception schedules with Arabic dates and times", () => {
    const populatedSchedules: OwnerDoctorSchedules = {
      doctor: {
        id: DOCTOR_ACTIVE.id,
        fullName: DOCTOR_ACTIVE.fullName,
        clinicName: CLINIC_ACTIVE.name,
        specialtyName: SPECIALTY_ACTIVE.name,
        slotDurationMinutes: 30,
        isActive: true,
      },
      weeklySchedules: [
        {
          id: "55000000-0000-0000-0000-000000000001",
          doctorId: DOCTOR_ACTIVE.id,
          dayOfWeek: 0,
          startTime: "09:00",
          endTime: "17:00",
          isActive: true,
          createdAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "55000000-0000-0000-0000-000000000002",
          doctorId: DOCTOR_ACTIVE.id,
          dayOfWeek: 2,
          startTime: "12:00",
          endTime: "15:00",
          isActive: false,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
      manualAvailabilities: [
        {
          id: "66000000-0000-0000-0000-000000000001",
          doctorId: DOCTOR_ACTIVE.id,
          availabilityDate: "2026-12-06",
          startTime: "18:00",
          endTime: "21:00",
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
      scheduleExceptions: [
        {
          id: "77000000-0000-0000-0000-000000000001",
          doctorId: DOCTOR_ACTIVE.id,
          exceptionDate: "2026-12-07",
          exceptionType: "CLOSED",
          startTime: null,
          endTime: null,
          reason: "إجازة رسمية",
          createdAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "77000000-0000-0000-0000-000000000002",
          doctorId: DOCTOR_ACTIVE.id,
          exceptionDate: "2026-12-08",
          exceptionType: "MODIFIED_HOURS",
          startTime: "10:00",
          endTime: "14:00",
          reason: "مؤتمر طبي صباحي",
          createdAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "77000000-0000-0000-0000-000000000003",
          doctorId: DOCTOR_ACTIVE.id,
          exceptionDate: "2026-12-09",
          exceptionType: "EXTRA_HOURS",
          startTime: "19:00",
          endTime: "21:00",
          reason: null,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
    };

    const html = renderWithoutWarnings(
      <OwnerDoctorScheduleManager initialData={populatedSchedules} />,
    );

    assert.match(html, /الجدول الأسبوعي الثابت/);
    assert.match(html, /مواعيد إضافية بتاريخ محدد/);
    assert.match(html, /استثناءات الجدول والإجازات/);

    assert.match(html, /الأحد/);
    assert.match(html, /الثلاثاء/);
    assert.match(html, /9:00 الصبح - 5:00 مساءً/);
    assert.match(html, /12:00 مساءً - 3:00 مساءً/);
    assert.match(html, />تعديل<\/button>/);
    assert.match(
      html,
      /aria-label="تعديل فترة الأحد \(9:00 الصبح - 5:00 مساءً\)"/,
    );
    assert.match(
      html,
      /aria-label="حذف الميعاد الإضافي الأحد، 6 ديسمبر 2026 \(6:00 مساءً - 9:00 مساءً\)"/,
    );
    assert.match(
      html,
      /aria-label="حذف استثناء الاثنين، 7 ديسمبر 2026"/,
    );

    assert.match(html, /الأحد، 6 ديسمبر 2026/);
    assert.match(html, /6:00 مساءً - 9:00 مساءً/);

    assert.match(html, /الاثنين، 7 ديسمبر 2026/);
    assert.match(html, /يوم مقفول \/ إجازة/);
    assert.match(html, /السبب: إجازة رسمية/);

    assert.match(html, /الثلاثاء، 8 ديسمبر 2026/);
    assert.match(html, /تعديل ساعات العمل/);
    assert.match(html, /10:00 الصبح - 2:00 مساءً/);
    assert.match(html, /السبب: مؤتمر طبي صباحي/);

    assert.match(html, /الأربعاء، 9 ديسمبر 2026/);
    assert.match(html, /ساعات عمل إضافية/);
    assert.match(html, /7:00 مساءً - 9:00 مساءً/);
  });
});

describe("OwnerReceptionistsManager", () => {
  const clinicOptions = [
    { id: CLINIC_ACTIVE.id, name: CLINIC_ACTIVE.name, isActive: true },
    { id: CLINIC_INACTIVE.id, name: CLINIC_INACTIVE.name, isActive: false },
  ];

  it("renders empty state when no receptionists exist", () => {
    const html = renderWithoutWarnings(
      <OwnerReceptionistsManager
        initialReceptionists={[]}
        clinics={clinicOptions}
      />,
    );

    assert.match(html, /موظفي الاستقبال/);
    assert.match(html, /إضافة موظف استقبال جديد/);
    assert.match(html, /لسه مفيش حسابات لموظفي استقبال/);
    assert.match(html, /معروض 0 من 0 حساب/);
  });

  it("renders populated receptionist cards with ltr email, clinic name, and toggle actions", () => {
    const receptionists: OwnerReceptionist[] = [
      {
        id: "88000000-0000-0000-0000-000000000001",
        name: "منى إبراهيم",
        email: "mona.reception@example.com",
        clinicId: CLINIC_ACTIVE.id,
        clinicName: CLINIC_ACTIVE.name,
        clinicIsActive: true,
        isActive: true,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "88000000-0000-0000-0000-000000000002",
        name: "كريم سمير",
        email: "kareem.reception@example.com",
        clinicId: CLINIC_INACTIVE.id,
        clinicName: CLINIC_INACTIVE.name,
        clinicIsActive: false,
        isActive: false,
        createdAt: "2026-01-02T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
      },
    ];

    const html = renderWithoutWarnings(
      <OwnerReceptionistsManager
        initialReceptionists={receptionists}
        clinics={clinicOptions}
      />,
    );

    assert.match(html, /معروض 2 من 2 حساب/);
    assert.match(html, /منى إبراهيم/);
    assert.match(html, /كريم سمير/);
    assert.match(
      html,
      /<dd[^>]*dir="ltr"[^>]*>mona\.reception@example\.com<\/dd>/,
    );
    assert.match(
      html,
      /<dd[^>]*dir="ltr"[^>]*>kareem\.reception@example\.com<\/dd>/,
    );
    assert.match(html, /عيادة النيل التخصصية/);
    assert.match(html, /عيادة السلام القديمة/);
    assert.match(html, /\(عيادة غير نشطة\)/);
    assert.match(html, /نشط/);
    assert.match(html, /غير نشط/);
    assert.match(html, /تعديل البيانات/);
    assert.match(html, /تعطيل الحساب/);
    assert.match(html, /تفعيل الحساب/);
  });
});

describe("OwnerAppointmentsView", () => {
  const clinicOptions: OwnerAppointmentClinicOption[] = [
    { id: CLINIC_ACTIVE.id, name: CLINIC_ACTIVE.name, isActive: true },
    { id: CLINIC_INACTIVE.id, name: CLINIC_INACTIVE.name, isActive: false },
  ];

  const doctorOptions: OwnerAppointmentDoctorOption[] = [
    {
      id: DOCTOR_ACTIVE.id,
      fullName: DOCTOR_ACTIVE.fullName,
      clinicId: CLINIC_ACTIVE.id,
      isActive: true,
    },
    {
      id: DOCTOR_INACTIVE.id,
      fullName: DOCTOR_INACTIVE.fullName,
      clinicId: CLINIC_INACTIVE.id,
      isActive: false,
    },
  ];

  it("renders empty state and filter controls when no appointments exist", () => {
    const html = renderWithoutWarnings(
      <OwnerAppointmentsView
        initialAppointments={[]}
        clinics={clinicOptions}
        doctors={doctorOptions}
        initialTodayDate="2026-12-06"
      />,
    );

    assert.match(html, /الحجوزات/);
    assert.match(html, /id="owner-appointments-query"/);
    assert.match(html, /حجوزات النهارده/);
    assert.match(html, /عرض كل التواريخ/);
    assert.match(html, /إعادة ضبط الفلاتر/);
    assert.match(html, /إجمالي 0 حجز/);
    assert.match(html, /لسه مفيش حجوزات مسجلة/);
    assert.match(html, /عيادة السلام القديمة \(غير نشطة\)/);
    assert.match(html, /د\. سارة عباس \(غير نشط\)/);
  });

  it("renders populated appointments with BookingStatusBadge and inactive doctor/clinic badges", () => {
    const html = renderWithoutWarnings(
      <OwnerAppointmentsView
        initialAppointments={[
          APPOINTMENT_TODAY_ACTIVE,
          APPOINTMENT_INACTIVE_DOCTOR,
          APPOINTMENT_INACTIVE_CLINIC,
        ]}
        clinics={clinicOptions}
        doctors={doctorOptions}
        initialTodayDate="2026-12-06"
      />,
    );

    assert.match(html, /إجمالي 3 حجز/);
    assert.match(html, /DR-8K29P4/);
    assert.match(html, /DR-5T43W1/);
    assert.match(html, /DR-9M12Q7/);
    assert.match(html, /سارة محمود علي/);
    assert.match(html, /محمد حسن إبراهيم/);
    assert.match(html, /هبة عبد الله/);
    assert.match(html, /مؤكد/);
    assert.match(html, /خلص/);
    assert.match(html, /وصل العيادة/);
    assert.match(html, /الأحد، 6 ديسمبر 2026/);
    assert.match(html, /الاثنين، 7 ديسمبر 2026/);
    assert.match(html, /الثلاثاء، 8 ديسمبر 2026/);
    assert.equal((html.match(/دكتور غير نشط/g) ?? []).length, 1);
    assert.equal((html.match(/عيادة غير نشطة/g) ?? []).length, 1);
  });
});
