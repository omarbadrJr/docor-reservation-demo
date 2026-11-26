import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { BookingPatientForm } from "./booking-patient-form";

const noopSubmit = async () => {};

describe("BookingPatientForm", () => {
  it("renders selected date/time summary, both fields, and أكّد الحجز submit button", () => {
    const html = renderToStaticMarkup(
      <BookingPatientForm
        selectedDate="2026-12-04"
        selectedSlot={{ start: "09:00", end: "09:30" }}
        serverError={null}
        isSubmitting={false}
        onSubmit={noopSubmit}
      />,
    );

    assert.match(html, /الجمعة، 4 ديسمبر 2026/);
    assert.match(html, /9:00 الصبح - 9:30 الصبح/);
    assert.match(html, /الاسم بالكامل/);
    assert.match(html, /رقم الموبايل/);
    assert.match(html, /أكّد الحجز/);

    const inputs = html.match(/<input\b[^>]*>/g) ?? [];
    assert.equal(inputs.length, 2);
    assert.match(inputs[0], /name="patientName"/);
    assert.match(inputs[0], /autoComplete="name"/i);
    assert.match(inputs[1], /name="patientPhone"/);
    assert.match(inputs[1], /type="tel"/);
    assert.match(inputs[1], /inputMode="tel"/i);
    assert.match(inputs[1], /dir="ltr"/);

    const submitButton = html.match(
      /<button[^>]*type="submit"[^>]*>[\s\S]*?<\/button>/,
    );
    assert.ok(submitButton);
    assert.doesNotMatch(submitButton[0], /disabled=""/);
  });

  it("renders serverError in role=alert and surfaces serverFieldErrors on inputs", () => {
    const html = renderToStaticMarkup(
      <BookingPatientForm
        selectedDate="2026-12-04"
        selectedSlot={{ start: "09:00", end: "09:30" }}
        serverError="بيانات الحجز مش مظبوطة، راجعها وحاول تاني."
        serverFieldErrors={{
          patientName: "اكتب اسمك بالكامل (3 حروف على الأقل).",
          patientPhone: "اكتب رقم موبايل صح (أرقام بس، من 7 لـ 20 رقم).",
        }}
        isSubmitting={false}
        onSubmit={noopSubmit}
      />,
    );

    assert.match(
      html,
      /role="alert"[^>]*>[\s\S]*?بيانات الحجز مش مظبوطة، راجعها وحاول تاني\./,
    );
    assert.match(html, /اكتب اسمك بالكامل \(3 حروف على الأقل\)\./);
    assert.match(html, /اكتب رقم موبايل صح \(أرقام بس، من 7 لـ 20 رقم\)\./);

    const invalidInputs = html.match(/<input\b[^>]*aria-invalid="true"[^>]*>/g) ?? [];
    assert.equal(invalidInputs.length, 2);
  });

  it("disables form controls and shows submitting label while submitting or disabled", () => {
    const submittingHtml = renderToStaticMarkup(
      <BookingPatientForm
        selectedDate="2026-12-04"
        selectedSlot={{ start: "09:00", end: "09:30" }}
        serverError={null}
        isSubmitting={true}
        onSubmit={noopSubmit}
      />,
    );

    assert.match(submittingHtml, /بنأكد الحجز\.\.\./);
    assert.match(
      submittingHtml,
      /<button[^>]*type="submit"[^>]*disabled=""[^>]*>/,
    );

    const disabledHtml = renderToStaticMarkup(
      <BookingPatientForm
        selectedDate="2026-12-04"
        selectedSlot={{ start: "09:00", end: "09:30" }}
        serverError={null}
        isSubmitting={false}
        disabled={true}
        onSubmit={noopSubmit}
      />,
    );

    assert.match(
      disabledHtml,
      /<button[^>]*type="submit"[^>]*disabled=""[^>]*>/,
    );
  });
});
