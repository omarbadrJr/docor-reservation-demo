import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { BookingConfirmationData } from "@/types/booking";

import { BookingConfirmation } from "./booking-confirmation";

const booking: BookingConfirmationData = {
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
  appointmentDate: "2026-12-04",
  startTime: "09:00",
  endTime: "09:30",
  qrCodeDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
};

describe("BookingConfirmation", () => {
  it("renders the appointment slip with reference, QR image, clinic address, and links", () => {
    const html = renderToStaticMarkup(
      <BookingConfirmation booking={booking} />,
    );

    assert.match(html, /تم تأكيد حجزك!/);
    assert.match(html, /مؤكد/);
    assert.match(html, /رقم الحجز/);
    assert.match(html, /DR-8K29P4/);
    assert.match(html, /انسخ رقم الحجز/);
    assert.match(html, /<img[^>]+src="data:image\/png;base64,/);
    assert.match(html, /alt="كود QR للحجز رقم DR-8K29P4"/);
    assert.match(
      html,
      /خد سكرين شوت للصفحة دي أو احفظ رقم الحجز عشان هتحتاجه لما تروح العيادة\./,
    );

    assert.match(html, /اسم المريض/);
    assert.match(html, /محمود علي حسن/);
    assert.match(html, /رقم الموبايل/);
    assert.match(html, /01012345678/);
    assert.match(html, /الدكتور/);
    assert.match(html, /د\. أحمد مصطفى/);
    assert.match(html, /التخصص/);
    assert.match(html, /باطنة/);
    assert.match(html, /اسم العيادة/);
    assert.match(html, /عيادة النيل/);
    assert.match(html, /عنوان العيادة/);
    assert.match(html, /شارع النيل، الدنجاوة، البحيرة/);
    assert.match(html, /تاريخ الحجز/);
    assert.match(html, /الجمعة، 4 ديسمبر 2026/);
    assert.match(html, /معاد الحجز/);
    assert.match(html, /9:00 الصبح - 9:30 الصبح/);
    assert.match(html, /الكشف/);
    assert.match(html, /150 جنيه/);

    assert.match(html, /href="\/my-booking"/);
    assert.match(html, /عندي حجز بالفعل/);
    assert.match(html, /href="\/specialties"/);
    assert.match(html, /احجز عند دكتور تاني/);
  });
});
