import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { DoctorAvailability, TimeSlot } from "@/types/availability";

import { BookingSlotPicker } from "./booking-slot-picker";

const noop = () => {};

const slots: TimeSlot[] = [
  { start: "09:00", end: "09:30" },
  { start: "17:30", end: "18:00" },
];

const availableDay: DoctorAvailability = {
  date: "2026-12-04",
  state: "AVAILABLE",
  slots,
};

describe("BookingSlotPicker", () => {
  it("prompts to pick a date when no date is selected", () => {
    const html = renderToStaticMarkup(
      <BookingSlotPicker
        selectedDate={null}
        availability={null}
        selectedSlot={null}
        isLoading={false}
        error={null}
        onSelectSlot={noop}
        onRetry={noop}
      />,
    );

    assert.match(html, /المواعيد المتاحة/);
    assert.match(
      html,
      /اختار يوم متاح من فوق عشان تشوف المواعيد الفاضية\./,
    );
  });

  it("renders formatted Arabic date, 12-hour slot labels, and aria-pressed state", () => {
    const html = renderToStaticMarkup(
      <BookingSlotPicker
        selectedDate="2026-12-04"
        availability={availableDay}
        selectedSlot={slots[1]}
        isLoading={false}
        error={null}
        onSelectSlot={noop}
        onRetry={noop}
      />,
    );

    assert.match(html, /المواعيد المتاحة/);
    assert.match(html, /الجمعة، 4 ديسمبر 2026/);
    assert.match(html, /9:00 الصبح/);
    assert.match(html, /5:30 بالليل/);

    const morningButton = html.match(
      /<button[^>]*>[\s\S]*?9:00 الصبح[\s\S]*?<\/button>/,
    );
    assert.ok(morningButton);
    assert.match(morningButton[0], /aria-pressed="false"/);

    const eveningButton = html.match(
      /<button[^>]*>[\s\S]*?5:30 بالليل[\s\S]*?<\/button>/,
    );
    assert.ok(eveningButton);
    assert.match(eveningButton[0], /aria-pressed="true"/);
  });

  it("renders OFF, FULL, loading, and error states", () => {
    const offHtml = renderToStaticMarkup(
      <BookingSlotPicker
        selectedDate="2026-12-04"
        availability={{ date: "2026-12-04", state: "OFF", slots: [] }}
        selectedSlot={null}
        isLoading={false}
        error={null}
        onSelectSlot={noop}
        onRetry={noop}
      />,
    );
    assert.match(offHtml, /الدكتور مش شغال في اليوم ده\. اختار يوم تاني\./);

    const fullHtml = renderToStaticMarkup(
      <BookingSlotPicker
        selectedDate="2026-12-04"
        availability={{ date: "2026-12-04", state: "FULL", slots: [] }}
        selectedSlot={null}
        isLoading={false}
        error={null}
        onSelectSlot={noop}
        onRetry={noop}
      />,
    );
    assert.match(fullHtml, /كل مواعيد اليوم ده اتحجزت\. اختار يوم تاني\./);

    const loadingHtml = renderToStaticMarkup(
      <BookingSlotPicker
        selectedDate="2026-12-04"
        availability={null}
        selectedSlot={null}
        isLoading={true}
        error={null}
        onSelectSlot={noop}
        onRetry={noop}
      />,
    );
    assert.match(loadingHtml, /بنحمّل المواعيد المتاحة/);

    const errorHtml = renderToStaticMarkup(
      <BookingSlotPicker
        selectedDate="2026-12-04"
        availability={null}
        selectedSlot={null}
        isLoading={false}
        error="تعذر تحميل المواعيد."
        onSelectSlot={noop}
        onRetry={noop}
      />,
    );
    assert.match(errorHtml, /تعذر تحميل المواعيد\./);
    assert.match(errorHtml, /جرّب تاني/);
  });
});
