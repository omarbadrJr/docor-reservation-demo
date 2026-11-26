import QRCode from "qrcode";

/**
 * Generates a PNG data URL encoding the given booking QR token.
 */
export async function generateBookingQrDataUrl(qrToken: string): Promise<string> {
  const trimmed = qrToken.trim();
  if (trimmed.length === 0) {
    throw new Error("QR token is required");
  }

  return QRCode.toDataURL(trimmed, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 240,
    color: {
      dark: "#102c34",
      light: "#ffffff",
    },
  });
}
