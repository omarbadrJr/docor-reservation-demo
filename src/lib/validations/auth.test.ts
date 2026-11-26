import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import {
  getDefaultDashboardPath,
  loginFormSchema,
  parseLoginInput,
  sanitizeRedirectPath,
  type LoginFormValues,
} from "./auth";

describe("loginFormSchema", () => {
  it("keeps identical input and output types without transforms for react-hook-form", () => {
    type InputType = z.input<typeof loginFormSchema>;
    type OutputType = z.output<typeof loginFormSchema>;

    const sampleInput: InputType = {
      email: "  Owner@Demo.Clinic  ",
      password: "  SecretPass123  ",
    };
    const sampleOutput: OutputType = sampleInput;
    const typedValues: LoginFormValues = sampleOutput;

    assert.equal(typeof zodResolver(loginFormSchema), "function");

    const result = loginFormSchema.safeParse(typedValues);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.email, "  Owner@Demo.Clinic  ");
      assert.equal(result.data.password, "  SecretPass123  ");
    }
  });

  it("accepts a valid email and a 128-character password", () => {
    const result = loginFormSchema.safeParse({
      email: "receptionist@clinic.eg",
      password: "a".repeat(128),
    });

    assert.equal(result.success, true);
  });

  it("rejects empty or whitespace-only email with required message", () => {
    for (const email of ["", "   "]) {
      const result = loginFormSchema.safeParse({
        email,
        password: "Password123!",
      });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error.issues.length, 1);
        assert.equal(result.error.issues[0]?.message, "اكتب البريد الإلكتروني");
      }
    }
  });

  it("rejects malformed email addresses", () => {
    for (const email of ["not-an-email", "user@", "@domain.com", "a b@c.com"]) {
      const result = loginFormSchema.safeParse({
        email,
        password: "Password123!",
      });
      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error.issues[0]?.message, "اكتب بريد إلكتروني صحيح");
      }
    }
  });

  it("rejects empty password and passwords longer than 128 characters", () => {
    const emptyResult = loginFormSchema.safeParse({
      email: "owner@clinic.eg",
      password: "",
    });
    assert.equal(emptyResult.success, false);
    if (!emptyResult.success) {
      assert.equal(emptyResult.error.issues[0]?.message, "اكتب كلمة المرور");
    }

    const longResult = loginFormSchema.safeParse({
      email: "owner@clinic.eg",
      password: "p".repeat(129),
    });
    assert.equal(longResult.success, false);
    if (!longResult.success) {
      assert.equal(longResult.error.issues[0]?.message, "كلمة المرور طويلة جداً");
    }
  });
});

describe("parseLoginInput", () => {
  it("handles non-object payloads cleanly with a generic Egyptian Arabic message", () => {
    for (const payload of [null, undefined, "email@test.com", 42, []]) {
      const result = parseLoginInput(payload);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(
          result.message,
          "بيانات الدخول مش مظبوطة، راجعها وحاول تاني.",
        );
        assert.deepEqual(result.fieldErrors, {});
      }
    }
  });

  it("trims and lowercases email while keeping password verbatim", () => {
    const result = parseLoginInput({
      email: "  Owner.Admin@Clinic.EG  ",
      password: "  Pass Word 123  ",
    });

    assert.equal(result.success, true);
    if (result.success) {
      assert.deepEqual(result.data, {
        email: "owner.admin@clinic.eg",
        password: "  Pass Word 123  ",
      });
      assert.equal("next" in result.data, false);
    }
  });

  it("preserves optional next only when it is a string", () => {
    const withNext = parseLoginInput({
      email: "owner@clinic.eg",
      password: "Password123",
      next: "/owner/doctors?active=true",
    });
    assert.equal(withNext.success, true);
    if (withNext.success) {
      assert.equal(withNext.data.next, "/owner/doctors?active=true");
    }

    for (const invalidNext of [123, null, {}, ["/owner"]]) {
      const result = parseLoginInput({
        email: "owner@clinic.eg",
        password: "Password123",
        next: invalidNext,
      });
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal("next" in result.data, false);
      }
    }
  });

  it("returns the field error message when a single field is invalid", () => {
    const result = parseLoginInput({
      email: "bad-email",
      password: "Password123",
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.message, "اكتب بريد إلكتروني صحيح");
      assert.deepEqual(result.fieldErrors, {
        email: "اكتب بريد إلكتروني صحيح",
      });
    }
  });

  it("returns generic message and both fieldErrors when email and password are invalid", () => {
    const result = parseLoginInput({
      email: "   ",
      password: "",
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(
        result.message,
        "بيانات الدخول مش مظبوطة، راجعها وحاول تاني.",
      );
      assert.deepEqual(result.fieldErrors, {
        email: "اكتب البريد الإلكتروني",
        password: "اكتب كلمة المرور",
      });
    }
  });
});

describe("getDefaultDashboardPath", () => {
  it("maps each admin role to its dashboard path", () => {
    assert.equal(getDefaultDashboardPath("OWNER"), "/owner");
    assert.equal(getDefaultDashboardPath("RECEPTIONIST"), "/receptionist");
  });
});

describe("sanitizeRedirectPath", () => {
  it("falls back to role default for null, undefined, or empty values", () => {
    for (const value of [null, undefined, "", "   "]) {
      assert.equal(sanitizeRedirectPath(value, "OWNER"), "/owner");
      assert.equal(sanitizeRedirectPath(value, "RECEPTIONIST"), "/receptionist");
    }
  });

  it("allows valid role dashboard paths and subpaths with query strings and hashes", () => {
    assert.equal(sanitizeRedirectPath("/owner", "OWNER"), "/owner");
    assert.equal(
      sanitizeRedirectPath("  /owner/doctors?active=true&page=2#list  ", "OWNER"),
      "/owner/doctors?active=true&page=2#list",
    );
    assert.equal(
      sanitizeRedirectPath("/receptionist", "RECEPTIONIST"),
      "/receptionist",
    );
    assert.equal(
      sanitizeRedirectPath(
        "/receptionist/appointments?date=2026-11-26#checkin",
        "RECEPTIONIST",
      ),
      "/receptionist/appointments?date=2026-11-26#checkin",
    );
  });

  it("rejects open redirects, protocol-relative URLs, backslashes, and external URLs", () => {
    const maliciousTargets = [
      "//evil.com",
      "//evil.com/owner",
      "https://evil.com",
      "https://evil.com/owner",
      "http://evil.com/receptionist",
      "/\\evil",
      "/\\evil.com/owner",
      "\\evil.com",
      "javascript:alert(1)",
      "///evil.com/owner",
      "/owner//nested",
    ];

    for (const target of maliciousTargets) {
      assert.equal(sanitizeRedirectPath(target, "OWNER"), "/owner");
      assert.equal(
        sanitizeRedirectPath(target, "RECEPTIONIST"),
        "/receptionist",
      );
    }
  });

  it("rejects control characters, traversal segments, and malformed percent encoding", () => {
    const badPaths = [
      "/owner\r\nLocation: https://evil.com",
      "/owner\0/doctors",
      "/owner/../login",
      "/owner/../receptionist",
      "/owner/%2e%2e/login",
      "/owner/%2e%2e/owner",
      "/owner/%2f..%2flogin",
      "/owner/%5c..%5clogin",
      "/owner/%E0%A4%A",
    ];

    for (const target of badPaths) {
      assert.equal(sanitizeRedirectPath(target, "OWNER"), "/owner");
    }
  });

  it("rejects prefix lookalikes, /login, /api/*, patient routes, and cross-role paths", () => {
    const disallowedForOwner = [
      "/owner-fake",
      "/ownership",
      "/owner@evil.com",
      "/login",
      "/login?next=/owner",
      "/api/appointments",
      "/",
      "/doctors",
      "/my-booking",
      "/receptionist",
      "/receptionist/today",
    ];

    for (const target of disallowedForOwner) {
      assert.equal(sanitizeRedirectPath(target, "OWNER"), "/owner");
    }

    const disallowedForReceptionist = [
      "/receptionist2",
      "/receptionist-admin",
      "/receptionist@evil.com",
      "/login",
      "/api/specialties",
      "/",
      "/specialties",
      "/owner",
      "/owner/doctors",
    ];

    for (const target of disallowedForReceptionist) {
      assert.equal(
        sanitizeRedirectPath(target, "RECEPTIONIST"),
        "/receptionist",
      );
    }
  });
});
