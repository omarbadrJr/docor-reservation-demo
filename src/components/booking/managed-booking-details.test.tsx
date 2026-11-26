import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Dialog } from "@/components/ui/dialog";
import type { ManagedBookingData } from "@/types/booking";

import {
  CancelBookingDialogContent,
  ManagedBookingDetails,
} from "./managed-booking-details";

const noop = () => {};

const baseBooking: ManagedBookingData = {
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
  qrCodeDataUrl:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  isDoctorActive: true,
  isPast: false,
  canReschedule: true,
  canCancel: true,
};

describe("ManagedBookingDetails", () => {
  it("renders booking slip, QR code, and غيّر معادك / إلغاء الحجز actions for active bookings", () => {
    const html = renderToStaticMarkup(
      <ManagedBookingDetails
        booking={baseBooking}
        showBackToList={true}
        feedbackMessage="تم تغيير معاد حجزك بنجاح!"
        onBackToList={noop}
        onStartReschedule={noop}
        onCancelDialogOpenChange={noop}
        onConfirmCancel={noop}
      />,
    );

    assert.match(html, /رجوع لكل حجوزاتك/);
    assert.match(html, /تم تغيير معاد حجزك بنجاح!/);
    assert.match(html, /تفاصيل حجزك/);
    assert.match(html, /DR-8K29P4/);
    assert.match(html, /<img[^>]+src="data:image\/png;base64,/);
    assert.match(html, /عنوان العيادة/);
    assert.match(html, /شارع النيل، الدنجاوة، البحيرة/);
    assert.match(html, /غيّر معادك/);
    assert.match(html, /إلغاء الحجز/);
  });

  it("disables غيّر معادك with a clear note when the doctor is inactive while keeping cancellation enabled", () => {
    const html = renderToStaticMarkup(
      <ManagedBookingDetails
        booking={{
          ...baseBooking,
          isDoctorActive: false,
          canReschedule: false,
          canCancel: true,
        }}
        onStartReschedule={noop}
        onCancelDialogOpenChange={noop}
        onConfirmCancel={noop}
      />,
    );

    assert.match(
      html,
      /الدكتور ده غير متاح لتغيير المعاد دلوقتي، لكن تقدر تلغي الحجز\./,
    );
    const rescheduleButton = html.match(
      /<button\b(?:(?!<\/button>)[\s\S])*?غيّر معادك(?:(?!<\/button>)[\s\S])*?<\/button>/,
    );
    assert.ok(rescheduleButton);
    assert.match(rescheduleButton[0], /disabled=""/);

    const cancelButton = html.match(
      /<button\b(?:(?!<\/button>)[\s\S])*?إلغاء الحجز(?:(?!<\/button>)[\s\S])*?<\/button>/,
    );
    assert.ok(cancelButton);
    assert.doesNotMatch(cancelButton[0], /disabled=""/);
  });

  it("hides modification buttons and QR code for cancelled bookings", () => {
    const html = renderToStaticMarkup(
      <ManagedBookingDetails
        booking={{
          ...baseBooking,
          status: "CANCELLED",
          canReschedule: false,
          canCancel: false,
        }}
        onStartReschedule={noop}
        onCancelDialogOpenChange={noop}
        onConfirmCancel={noop}
      />,
    );

    assert.match(html, /ملغي/);
    assert.doesNotMatch(html, /<img[^>]+src="data:image\/png;base64,/);
    assert.doesNotMatch(
      html,
      /<button\b(?:(?!<\/button>)[\s\S])*?غيّر معادك(?:(?!<\/button>)[\s\S])*?<\/button>/,
    );
    assert.doesNotMatch(
      html,
      /<button\b(?:(?!<\/button>)[\s\S])*?إلغاء الحجز(?:(?!<\/button>)[\s\S])*?<\/button>/,
    );
    assert.match(html, /احجز معاد جديد/);
  });

  it("renders the Egyptian Arabic cancellation confirmation prompt and buttons", () => {
    const html = renderToStaticMarkup(
      <Dialog open={true}>
        <CancelBookingDialogContent
          booking={baseBooking}
          isCancelling={false}
          error="حصلت مشكلة، جرّب تاني."
          onConfirmCancel={noop}
        />
      </Dialog>,
    );

    assert.match(html, /متأكد إنك عايز تلغي الحجز؟/);
    assert.match(html, /د\. أحمد مصطفى/);
    assert.match(html, /الجمعة، 4 ديسمبر 2026/);
    assert.match(html, /9:00 الصبح/);
    assert.match(html, /حصلت مشكلة، جرّب تاني\./);
    assert.match(html, /أيوه، ألغي الحجز/);
    assert.match(html, /لا، خليه زي ما هو/);
  });
});
