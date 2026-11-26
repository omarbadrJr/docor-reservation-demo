import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { renderToStaticMarkup } from "react-dom/server";

import {
  formatRetryAfterHint,
  LoginForm,
  type LoginFormProps,
} from "./login-form";

const mockRouter: AppRouterInstance = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
  bfcacheId: "test-bfcache-id",
};

function renderLoginForm(props: LoginFormProps = {}): string {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={mockRouter}>
      <LoginForm {...props} />
    </AppRouterContext.Provider>,
  );
}

describe("LoginForm", () => {
  it("renders Egyptian Arabic copy, accessible email/password fields, submit button, and patient home link", () => {
    const html = renderLoginForm({ nextPath: "/owner" });

    assert.match(html, /دخول الإدارة والاستقبال/);
    assert.match(html, /لو إنت مريض وعايز تحجز، مش محتاج حساب\./);
    assert.match(html, /البريد الإلكتروني/);
    assert.match(html, /كلمة المرور/);
    assert.match(html, /تسجيل الدخول/);
    assert.doesNotMatch(html, /role="alert"/);

    const emailInput = html.match(/<input\b[^>]*id="login-email"[^>]*>/);
    assert.ok(emailInput);
    assert.match(emailInput[0], /name="email"/);
    assert.match(emailInput[0], /type="email"/);
    assert.match(emailInput[0], /dir="ltr"/);
    assert.match(emailInput[0], /autoComplete="email"/i);

    const passwordInput = html.match(/<input\b[^>]*id="login-password"[^>]*>/);
    assert.ok(passwordInput);
    assert.match(passwordInput[0], /name="password"/);
    assert.match(passwordInput[0], /type="password"/);
    assert.match(passwordInput[0], /autoComplete="current-password"/i);

    const toggleButton = html.match(
      /<button[^>]*aria-label="إظهار كلمة المرور"[^>]*>/,
    );
    assert.ok(toggleButton);
    assert.match(toggleButton[0], /type="button"/);
    assert.match(toggleButton[0], /aria-pressed="false"/);

    const submitButton = html.match(
      /<button[^>]*type="submit"[^>]*>[\s\S]*?<\/button>/,
    );
    assert.ok(submitButton);
    assert.doesNotMatch(submitButton[0], /disabled=""/);

    assert.match(html, /<a[^>]*href="\/"[^>]*>[\s\S]*?رجوع لصفحة الحجز/);
  });

  it("renders an inactive account alert banner when initialReason is inactive", () => {
    const html = renderLoginForm({ initialReason: "inactive" });

    assert.match(
      html,
      /role="alert"[^>]*>[\s\S]*?الحساب ده غير نشط حالياً\. تواصل مع إدارة المنصة\./,
    );
  });

  it("does not render an alert banner for unrecognized initialReason values", () => {
    const html = renderLoginForm({ initialReason: "expired" });

    assert.doesNotMatch(html, /role="alert"/);
    assert.doesNotMatch(html, /الحساب ده غير نشط حالياً/);
  });
});

describe("formatRetryAfterHint", () => {
  it("formats a wait hint for RATE_LIMITED responses with positive retryAfterSeconds", () => {
    assert.equal(
      formatRetryAfterHint("RATE_LIMITED", 45),
      "تقدر تحاول تاني بعد 45 ثانية.",
    );
    assert.equal(
      formatRetryAfterHint("RATE_LIMITED", 12.2),
      "تقدر تحاول تاني بعد 13 ثانية.",
    );
  });

  it("returns null for other error codes or missing durations", () => {
    assert.equal(formatRetryAfterHint("INVALID_CREDENTIALS", 30), null);
    assert.equal(formatRetryAfterHint("RATE_LIMITED", undefined), null);
    assert.equal(formatRetryAfterHint("RATE_LIMITED", 0), null);
    assert.equal(formatRetryAfterHint("RATE_LIMITED", -5), null);
  });
});
