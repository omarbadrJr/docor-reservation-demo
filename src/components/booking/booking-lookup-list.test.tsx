import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { ManagedBookingData } from "@/types/booking";

import { BookingLookupList } from "./booking-lookup-list";

const baseBooking: ManagedBookingData = {
  id: "44000000-0000-0000-0000-000000000001",
  referenceNumber: "DR-8K29P4",
  status: "CONFIRMED",
  patientName: "سارة محمود علي",
  patientPhone: "01012345678",
  doctorId: "33000000-0000-0000-0000-000000000001",
  doctorName: "د. أحمد مصطفى",
  specialtyName: "باطنة",
  clinicName: "عيادة النيل",
  clinicAddress: "شارع النيل، الدنجاوة، البحيرة",
  consultationFee: "150.00",
  appointmentDate: "2026-12-04",
  startTime: "09:00",
  endTime: "09:30",
  qrCodeDataUrl: "data:image/png;base64,abc",
  isDoctorActive: true,
  isPast: false,
  canReschedule: true,
  canCancel: true,
};

describe("BookingLookupList", () => {
  it("renders all matching bookings with statuses, dates, references, and select buttons", () => {
    const html = renderToStaticMarkup(
      <BookingLookupList
        bookings={[
          baseBooking,
          {
            ...baseBooking,
            id: "44000000-0000-0000-0000-000000000002",
            referenceNumber: "DR-5T43W1",
            status: "CANCELLED",
            doctorName: "د. سارة عباس",
            specialtyName: "عظام",
            canReschedule: false,
            canCancel: false,
          },
        ]}
        onSelectBooking={() => {}}
      />,
    );

    assert.match(html, /لقينا 2 حجوزات بالرقم ده/);
    assert.match(html, /DR-8K29P4/);
    assert.match(html, /DR-5T43W1/);
    assert.match(html, /د\. أحمد مصطفى/);
    assert.match(html, /د\. سارة عباس/);
    assert.match(html, /مؤكد/);
    assert.match(html, /ملغي/);
    assert.match(html, /الجمعة، 4 ديسمبر 2026/);
    assert.match(html, /9:00 الصبح - 9:30 الصبح/);
    assert.equal((html.match(/عرض تفاصيل الحجز/g) ?? []).length, 2);
  });
});
