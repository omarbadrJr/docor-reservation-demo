import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createLoginRateLimiter, extractClientIp } from "./rate-limit";

describe("createLoginRateLimiter", () => {
  it("allows requests with fewer failures than maxPerPair", () => {
    const limiter = createLoginRateLimiter({
      windowMs: 60_000,
      maxPerPair: 3,
      maxPerIp: 10,
    });

    assert.deepEqual(limiter.check("203.0.113.1", "owner@example.com", 1_000), {
      allowed: true,
    });

    limiter.recordFailure("203.0.113.1", "owner@example.com", 1_000);
    limiter.recordFailure("203.0.113.1", "owner@example.com", 2_000);

    assert.deepEqual(limiter.check("203.0.113.1", "owner@example.com", 3_000), {
      allowed: true,
    });
  });

  it("blocks at maxPerPair with positive retryAfterSeconds and normalizes inputs", () => {
    const limiter = createLoginRateLimiter({
      windowMs: 60_000,
      maxPerPair: 3,
      maxPerIp: 10,
    });

    limiter.recordFailure(" 203.0.113.1 ", " Owner@Example.COM ", 1_000);
    limiter.recordFailure("203.0.113.1", "owner@example.com", 2_000);
    limiter.recordFailure("203.0.113.1", "OWNER@example.com", 3_000);

    const blocked = limiter.check("203.0.113.1", "owner@example.com", 3_500);
    assert.deepEqual(blocked, {
      allowed: false,
      retryAfterSeconds: 58,
    });

    // Empty/whitespace IP normalizes to "unknown" consistently across record and check.
    limiter.recordFailure("   ", "staff@example.com", 10_000);
    limiter.recordFailure("", "STAFF@example.com", 10_500);
    limiter.recordFailure("unknown", "staff@example.com", 11_000);

    assert.deepEqual(limiter.check("", "staff@example.com", 11_500), {
      allowed: false,
      retryAfterSeconds: 59,
    });

    // Other emails from the same IP remain allowed while below maxPerIp.
    assert.deepEqual(limiter.check("203.0.113.1", "other@example.com", 3_500), {
      allowed: true,
    });
  });

  it("blocks at maxPerIp across different emails and uses the longest retryAt when both limits hit", () => {
    const limiter = createLoginRateLimiter({
      windowMs: 60_000,
      maxPerPair: 3,
      maxPerIp: 5,
    });

    // 2 failures on email A, 2 on email B, 1 on email C -> total 5 failures on IP.
    limiter.recordFailure("198.51.100.7", "a@example.com", 1_000);
    limiter.recordFailure("198.51.100.7", "a@example.com", 2_000);
    limiter.recordFailure("198.51.100.7", "b@example.com", 3_000);
    limiter.recordFailure("198.51.100.7", "b@example.com", 4_000);
    limiter.recordFailure("198.51.100.7", "c@example.com", 5_000);

    // Even a brand new email from that IP is blocked; oldest IP hit was at 1_000 -> retryAt 61_000.
    assert.deepEqual(limiter.check("198.51.100.7", "d@example.com", 6_000), {
      allowed: false,
      retryAfterSeconds: 55,
    });

    // Different IP remains unaffected.
    assert.deepEqual(limiter.check("198.51.100.8", "d@example.com", 6_000), {
      allowed: true,
    });

    // Trigger pair limit later than IP limit on a fresh limiter to verify max(pairRetryAt, ipRetryAt).
    const dualLimiter = createLoginRateLimiter({
      windowMs: 60_000,
      maxPerPair: 2,
      maxPerIp: 4,
    });
    dualLimiter.recordFailure("198.51.100.9", "x@example.com", 1_000);
    dualLimiter.recordFailure("198.51.100.9", "y@example.com", 2_000);
    dualLimiter.recordFailure("198.51.100.9", "z@example.com", 10_000);
    dualLimiter.recordFailure("198.51.100.9", "z@example.com", 12_000);

    // IP limit clears at 1_000 + 60_000 = 61_000, but pair limit for z@ clears at 10_000 + 60_000 = 70_000.
    assert.deepEqual(dualLimiter.check("198.51.100.9", "z@example.com", 20_000), {
      allowed: false,
      retryAfterSeconds: 50,
    });
  });

  it("restores allowance as the sliding window expires using deterministic timestamps", () => {
    const limiter = createLoginRateLimiter({
      windowMs: 10_000,
      maxPerPair: 2,
      maxPerIp: 10,
    });

    limiter.recordFailure("203.0.113.5", "user@example.com", 1_000);
    limiter.recordFailure("203.0.113.5", "user@example.com", 4_000);

    // 1 ms before the oldest failure expires: still blocked with minimum 1 second Retry-After.
    assert.deepEqual(limiter.check("203.0.113.5", "user@example.com", 10_999), {
      allowed: false,
      retryAfterSeconds: 1,
    });

    // Exact expiration boundary of the first failure (1_000 + 10_000): 1 failure remains, allowed.
    assert.deepEqual(limiter.check("203.0.113.5", "user@example.com", 11_000), {
      allowed: true,
    });

    // Recording a new failure at 11_000 pairs with the remaining failure at 4_000 to block again.
    limiter.recordFailure("203.0.113.5", "user@example.com", 11_000);
    assert.deepEqual(limiter.check("203.0.113.5", "user@example.com", 11_500), {
      allowed: false,
      retryAfterSeconds: 3,
    });

    // Once 4_000 expires at 14_000, only the 11_000 failure remains -> allowed.
    assert.deepEqual(limiter.check("203.0.113.5", "user@example.com", 14_000), {
      allowed: true,
    });
  });

  it("reset unblocks only the specified (ip, email) pair", () => {
    const limiter = createLoginRateLimiter({
      windowMs: 60_000,
      maxPerPair: 2,
      maxPerIp: 10,
    });

    limiter.recordFailure("203.0.113.10", "first@example.com", 1_000);
    limiter.recordFailure("203.0.113.10", "first@example.com", 2_000);

    limiter.recordFailure("203.0.113.10", "second@example.com", 1_000);
    limiter.recordFailure("203.0.113.10", "second@example.com", 2_000);

    limiter.recordFailure("203.0.113.11", "first@example.com", 1_000);
    limiter.recordFailure("203.0.113.11", "first@example.com", 2_000);

    limiter.reset(" 203.0.113.10 ", " FIRST@example.com ");

    assert.deepEqual(limiter.check("203.0.113.10", "first@example.com", 3_000), {
      allowed: true,
    });
    assert.deepEqual(limiter.check("203.0.113.10", "second@example.com", 3_000), {
      allowed: false,
      retryAfterSeconds: 58,
    });
    assert.deepEqual(limiter.check("203.0.113.11", "first@example.com", 3_000), {
      allowed: false,
      retryAfterSeconds: 58,
    });
  });
});

describe("extractClientIp", () => {
  it("extracts the first trimmed entry from x-forwarded-for", () => {
    const single = new Request("http://localhost/login", {
      headers: { "x-forwarded-for": " 203.0.113.20 " },
    });
    assert.equal(extractClientIp(single), "203.0.113.20");

    const list = new Request("http://localhost/login", {
      headers: { "x-forwarded-for": " 198.51.100.1 , 70.41.3.18, 150.172.238.178 " },
    });
    assert.equal(extractClientIp(list), "198.51.100.1");
  });

  it("falls through when the first x-forwarded-for entry is blank", () => {
    const request = new Request("http://localhost/login", {
      headers: {
        "x-forwarded-for": " , 70.41.3.18",
        "x-real-ip": " 198.51.100.42 ",
      },
    });
    assert.equal(extractClientIp(request), "198.51.100.42");
  });

  it("prefers x-forwarded-for over x-real-ip over cf-connecting-ip", () => {
    const withAll = new Request("http://localhost/login", {
      headers: {
        "x-forwarded-for": "203.0.113.1",
        "x-real-ip": "203.0.113.2",
        "cf-connecting-ip": "203.0.113.3",
      },
    });
    assert.equal(extractClientIp(withAll), "203.0.113.1");

    const withoutXff = new Request("http://localhost/login", {
      headers: {
        "x-real-ip": " 203.0.113.2 ",
        "cf-connecting-ip": "203.0.113.3",
      },
    });
    assert.equal(extractClientIp(withoutXff), "203.0.113.2");

    const onlyCfIpv6 = new Request("http://localhost/login", {
      headers: {
        "cf-connecting-ip": " 2001:db8::1 ",
      },
    });
    assert.equal(extractClientIp(onlyCfIpv6), "2001:db8::1");
  });

  it("returns unknown for whitespace-only or missing IP headers", () => {
    const whitespaceOnly = new Request("http://localhost/login", {
      headers: {
        "x-forwarded-for": "   ",
        "x-real-ip": "\t",
        "cf-connecting-ip": "   ",
      },
    });
    assert.equal(extractClientIp(whitespaceOnly), "unknown");

    const noHeaders = new Request("http://localhost/login");
    assert.equal(extractClientIp(noHeaders), "unknown");
  });
});
