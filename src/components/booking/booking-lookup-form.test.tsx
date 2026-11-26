import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { BookingLookupForm } from "./booking-lookup-form";

const noop = () => {};

describe("BookingLookupForm", () => {
  it("renders reference search mode by default with clear labels and submit button", () => {
    const html = renderToStaticMarkup(
      <BookingLookupForm
        mode="reference"
        value="DR-8K29P4"
        isLoading={false}
        error={null}
        onModeChange={noop}
        onValueChange={noop}
        onSubmit={noop}
      />,
    );

    assert.match(html, /دوّر على حجزك/);
    assert.match(html, /برقم الحجز/);
    assert.match(html, /برقم الموبايل/);

    const refButton = html.match(
      /<button[^>]*>[\s\S]*?برقم الحجز[\s\S]*?<\/button>/,
    );
    assert.ok(refButton);
    assert.match(refButton[0], /aria-pressed="true"/);

    const phoneButton = html.match(
      /<button[^>]*>[\s\S]*?برقم الموبايل[\s\S]*?<\/button>/,
    );
    assert.ok(phoneButton);
    assert.match(phoneButton[0], /aria-pressed="false"/);

    assert.match(html, /name="reference"/);
    assert.match(html, /placeholder="DR-8K29P4"/);
    assert.match(html, /dir="ltr"/);
  });

  it("renders phone search mode and error/loading states cleanly", () => {
    const html = renderToStaticMarkup(
      <BookingLookupForm
        mode="phone"
        value="010"
        isLoading={true}
        error="اكتب رقم موبايل صح (أرقام بس، من 7 لـ 20 رقم)."
        onModeChange={noop}
        onValueChange={noop}
        onSubmit={noop}
      />,
    );

    assert.match(html, /name="phone"/);
    assert.match(html, /type="tel"/);
    assert.match(html, /aria-invalid="true"/);
    assert.match(html, /اكتب رقم موبايل صح \(أرقام بس، من 7 لـ 20 رقم\)\./);
    assert.match(html, /بندور على الحجز\.\.\./);
    assert.match(html, /<button[^>]*type="submit"[^>]*disabled=""/);
  });
});
