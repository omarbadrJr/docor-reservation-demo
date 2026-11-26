import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { AvailableDate } from "@/types/availability";

import { BookingDatePicker } from "./booking-date-picker";

const sampleDates: AvailableDate[] = [
  { date: "2026-12-01", state: "FULL" }, // past day classified FULL by backend
  { date: "2026-12-02", state: "OFF" }, // past day OFF
  { date: "2026-12-03", state: "AVAILABLE" }, // today AVAILABLE
  { date: "2026-12-04", state: "AVAILABLE" }, // selected AVAILABLE
  { date: "2026-12-05", state: "FULL" }, // future FULL
  { date: "2026-12-06", state: "OFF" }, // future OFF
];

const noop = () => {};

describe("BookingDatePicker", () => {
  it("renders Saturday-first RTL headers, status labels, past day as فات, and selected state", () => {
    const html = renderToStaticMarkup(
      <BookingDatePicker
        month="2026-12"
        minMonth="2026-12"
        todayDate="2026-12-03"
        dates={sampleDates}
        selectedDate="2026-12-04"
        isLoading={false}
        error={null}
        onSelectDate={noop}
        onChangeMonth={noop}
        onRetry={noop}
      />,
    );

    assert.match(html, /ديسمبر 2026/);
    assert.match(
      html,
      /السبت[\s\S]*الأحد[\s\S]*الاثنين[\s\S]*الثلاثاء[\s\S]*الأربعاء[\s\S]*الخميس[\s\S]*الجمعة/,
    );
    assert.match(html, /الشهر اللي فات/);
    assert.match(html, /الشهر اللي جاي/);
    assert.match(
      html,
      /<button[^>]*disabled=""[^>]*>[\s\S]*?الشهر اللي فات[\s\S]*?<\/button>/,
    );

    // Legend labels
    assert.match(html, /متاح/);
    assert.match(html, /مكتمل/);
    assert.match(html, /مقفول/);

    // Past day classified as FULL must render as disabled "فات" and NOT "مكتمل"
    const pastButtonMatch = html.match(
      /<button[^>]*aria-label="[^"]*1 ديسمبر 2026[^"]*"[^>]*>[\s\S]*?<\/button>/,
    );
    assert.ok(pastButtonMatch, "Expected past day button for 2026-12-01");
    assert.match(pastButtonMatch[0], /disabled=""/);
    assert.match(pastButtonMatch[0], /فات/);
    assert.doesNotMatch(pastButtonMatch[0], /مكتمل/);

    // Active selected AVAILABLE day is enabled and aria-pressed="true"
    const selectedButtonMatch = html.match(
      /<button[^>]*aria-label="[^"]*4 ديسمبر 2026[^"]*"[^>]*>[\s\S]*?<\/button>/,
    );
    assert.ok(selectedButtonMatch, "Expected active day button for 2026-12-04");
    assert.doesNotMatch(selectedButtonMatch[0], /disabled=""/);
    assert.match(selectedButtonMatch[0], /aria-pressed="true"/);
    assert.match(selectedButtonMatch[0], /متاح/);

    // Active unselected AVAILABLE day has aria-pressed="false"
    const todayButtonMatch = html.match(
      /<button[^>]*aria-label="[^"]*3 ديسمبر 2026[^"]*"[^>]*>[\s\S]*?<\/button>/,
    );
    assert.ok(todayButtonMatch, "Expected today button for 2026-12-03");
    assert.match(todayButtonMatch[0], /aria-pressed="false"/);
    assert.match(todayButtonMatch[0], /متاح/);

    // Future FULL and OFF buttons are disabled with proper labels
    const futureFullMatch = html.match(
      /<button[^>]*aria-label="[^"]*5 ديسمبر 2026[^"]*"[^>]*>[\s\S]*?<\/button>/,
    );
    assert.ok(futureFullMatch);
    assert.match(futureFullMatch[0], /disabled=""/);
    assert.match(futureFullMatch[0], /مكتمل/);

    const futureOffMatch = html.match(
      /<button[^>]*aria-label="[^"]*6 ديسمبر 2026[^"]*"[^>]*>[\s\S]*?<\/button>/,
    );
    assert.ok(futureOffMatch);
    assert.match(futureOffMatch[0], /disabled=""/);
    assert.match(futureOffMatch[0], /مقفول/);
  });

  it("shows next-month helper when no active available dates remain in the month", () => {
    const html = renderToStaticMarkup(
      <BookingDatePicker
        month="2026-12"
        minMonth="2026-11"
        todayDate="2026-12-10"
        dates={[
          { date: "2026-12-05", state: "AVAILABLE" }, // past
          { date: "2026-12-11", state: "FULL" },
          { date: "2026-12-12", state: "OFF" },
        ]}
        selectedDate={null}
        isLoading={false}
        error={null}
        onSelectDate={noop}
        onChangeMonth={noop}
        onRetry={noop}
      />,
    );

    assert.match(
      html,
      /مفيش مواعيد فاضية في الشهر ده\. جرّب الشهر اللي جاي\./,
    );
  });

  it("renders loading and error states with retry button", () => {
    const loadingHtml = renderToStaticMarkup(
      <BookingDatePicker
        month="2026-12"
        minMonth="2026-12"
        todayDate="2026-12-03"
        dates={[]}
        selectedDate={null}
        isLoading={true}
        error={null}
        onSelectDate={noop}
        onChangeMonth={noop}
        onRetry={noop}
      />,
    );
    assert.match(loadingHtml, /بنحمّل أيام الشهر/);

    const errorHtml = renderToStaticMarkup(
      <BookingDatePicker
        month="2026-12"
        minMonth="2026-12"
        todayDate="2026-12-03"
        dates={[]}
        selectedDate={null}
        isLoading={false}
        error="حصلت مشكلة في الشبكة."
        onSelectDate={noop}
        onChangeMonth={noop}
        onRetry={noop}
      />,
    );
    assert.match(errorHtml, /حصلت مشكلة في الشبكة\./);
    assert.match(errorHtml, /جرّب تاني/);
  });
});
