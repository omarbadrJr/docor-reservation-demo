import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { AvailableDate, DoctorAvailability } from "@/types/availability";
import type { ManagedBookingData } from "@/types/booking";

import { RescheduleBookingPanel } from "./reschedule-booking-panel";

const noop = () => {};

const booking: ManagedBookingData = {
  id: "44000000-0000-0000-0000-000000000001",
  referenceNumber: "DR-8K29P4",
  status: "CONFIRMED",
  patientName: "محمود علي حسن",
  patientPhone: "01012345678",
  doctorId: "33000000-0000-0000-0000-000000000001",
  doctorName: "د. أحمد مصطفى",
  specialtyName: "باطنة",
  clinicName: "عيادة النيل",
  clinicAddress: "شارع النيل، الدنجاوة، البحيرة",
  consultationFee: "150.00",
  appointmentDate: "2026-12-03",
  startTime: "09:00",
  endTime: "09:30",
  qrCodeDataUrl: "data:image/png;base64,abc",
  isDoctorActive: true,
  isPast: false,
  canReschedule: true,
  canCancel: true,
};

const initialDates: AvailableDate[] = [
  { date: "2026-12-03", state: "AVAILABLE" },
  { date: "2026-12-04", state: "AVAILABLE" },
];

const initialAvailability: DoctorAvailability = {
  date: "2026-12-04",
  state: "AVAILABLE",
  slots: [
    { start: "10:00", end: "10:30" },
    { start: "10:30", end: "11:00" },
  ],
};

describe("RescheduleBookingPanel", () => {
  it("renders current appointment summary, date picker, and slot picker", () => {
    const html = renderToStaticMarkup(
      <RescheduleBookingPanel
        booking={booking}
        todayDate="2026-12-03"
        initialMonth="2026-12"
        initialDates={initialDates}
        initialSelectedDate="2026-12-04"
        initialAvailability={initialAvailability}
        onCancelReschedule={noop}
        onRescheduled={noop}
      />,
    );

    assert.match(html, /رجوع لتفاصيل الحجز/);
    assert.match(
      html,
      /تغيير معاد الحجز[\s\S]*dir="ltr"[^>]*>DR-8K29P4<\/span>/,
    );
    assert.match(html, /د\. أحمد مصطفى/);
    assert.match(html, /معادك الحالي/);
    assert.match(html, /الخميس، 3 ديسمبر 2026/);
    assert.match(html, /9:00 الصبح - 9:30 الصبح/);
    assert.match(html, /المواعيد المتاحة/);
    assert.match(html, /10:00 الصبح/);
    assert.match(html, /10:30 الصبح/);
  });
});
