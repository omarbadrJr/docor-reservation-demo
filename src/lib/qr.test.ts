import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateBookingQrDataUrl } from "./qr";

describe("generateBookingQrDataUrl", () => {
  it("returns a PNG data URL with a non-empty base64 payload for a valid hex token", async () => {
    const dataUrl = await generateBookingQrDataUrl("a1b2c3d4e5f60718293a4b5c6d7e8f90");
    const prefix = "data:image/png;base64,";

    assert.equal(dataUrl.startsWith(prefix), true);

    const base64Payload = dataUrl.slice(prefix.length);
    assert.equal(base64Payload.length > 0, true);
    assert.equal(Buffer.from(base64Payload, "base64").length > 0, true);
  });

  it("produces different data URLs for two different tokens", async () => {
    const first = await generateBookingQrDataUrl("0123456789abcdef0123456789abcdef");
    const second = await generateBookingQrDataUrl("fedcba9876543210fedcba9876543210");

    assert.notEqual(first, second);
  });

  it("trims surrounding whitespace before generating the QR code", async () => {
    const token = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
    const expected = await generateBookingQrDataUrl(token);
    const actual = await generateBookingQrDataUrl(`  ${token}\n`);

    assert.equal(actual, expected);
  });

  it("rejects empty and whitespace-only tokens", async () => {
    await assert.rejects(() => generateBookingQrDataUrl(""), {
      message: "QR token is required",
    });
    await assert.rejects(() => generateBookingQrDataUrl("   \t\n  "), {
      message: "QR token is required",
    });
  });
});
