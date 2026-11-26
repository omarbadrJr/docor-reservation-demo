import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { renderToStaticMarkup } from "react-dom/server";

import {
  LogoutButton,
  LogoutButtonView,
  requestLogout,
} from "./logout-button";

const noop = () => {};

const mockRouter: AppRouterInstance = {
  back: noop,
  forward: noop,
  push: noop,
  replace: noop,
  refresh: noop,
  prefetch: noop,
  bfcacheId: "test-bfcache-id",
};

describe("LogoutButton", () => {
  it("renders the default sidebar variant with Arabic label, icon, and dark-surface contrast classes", () => {
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={mockRouter}>
        <LogoutButton />
      </AppRouterContext.Provider>,
    );

    assert.match(html, /تسجيل الخروج/);
    assert.match(html, /type="button"/);
    assert.match(html, /<svg\b/);
    assert.doesNotMatch(html, /disabled=""/);
    assert.match(html, /border-sidebar-border/);
    assert.match(html, /text-sidebar-foreground/);
    assert.match(html, /w-full/);
  });

  it("renders the header variant with header contrast classes and custom className", () => {
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={mockRouter}>
        <LogoutButton variant="header" className="custom-logout" />
      </AppRouterContext.Provider>,
    );

    assert.match(html, /تسجيل الخروج/);
    assert.match(html, /border-white\/20/);
    assert.match(html, /text-background/);
    assert.match(html, /custom-logout/);
  });

  it("renders pending state with disabled button, aria-busy, and Arabic loading copy", () => {
    const html = renderToStaticMarkup(
      <LogoutButtonView isPending={true} error={null} onLogout={noop} />,
    );

    assert.match(html, /جاري الخروج\.\.\./);
    assert.doesNotMatch(html, /تسجيل الخروج/);
    assert.match(html, /disabled=""/);
    assert.match(html, /aria-busy="true"/);
  });

  it("renders accessible inline error feedback when logout fails", () => {
    const html = renderToStaticMarkup(
      <LogoutButtonView
        isPending={false}
        error="مقدرناش نسجّل خروجك دلوقتي، جرّب تاني."
        onLogout={noop}
      />,
    );

    assert.match(html, /role="alert"/);
    assert.match(html, /aria-live="assertive"/);
    assert.match(html, /مقدرناش نسجّل خروجك دلوقتي، جرّب تاني\./);
  });
});

describe("requestLogout", () => {
  it("posts to /api/admin/logout and returns ok: true on 200 response", async () => {
    const calls: Array<{ input: string | URL | Request; init?: RequestInit }> =
      [];
    const fakeFetch: typeof fetch = async (input, init) => {
      calls.push({ input, init });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const result = await requestLogout(fakeFetch);

    assert.deepEqual(result, { ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.input, "/api/admin/logout");
    assert.equal(calls[0]?.init?.method, "POST");
  });

  it("returns the server Arabic error message on non-ok JSON response", async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({ error: "تعذر إنهاء الجلسة الحالية." }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );

    const result = await requestLogout(fakeFetch);

    assert.deepEqual(result, {
      ok: false,
      error: "تعذر إنهاء الجلسة الحالية.",
    });
  });

  it("falls back to default Arabic error on non-ok non-JSON response", async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response("Internal Server Error", { status: 500 });

    const result = await requestLogout(fakeFetch);

    assert.deepEqual(result, {
      ok: false,
      error: "مقدرناش نسجّل خروجك دلوقتي، جرّب تاني.",
    });
  });

  it("returns Arabic connection error when fetch rejects", async () => {
    const fakeFetch: typeof fetch = async () => {
      throw new Error("Network down");
    };

    const result = await requestLogout(fakeFetch);

    assert.deepEqual(result, {
      ok: false,
      error: "حصلت مشكلة في الاتصال، جرّب تاني.",
    });
  });
});
