import type { Metadata, Viewport } from "next";
import { Cairo, Tajawal } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "حجز دكتور | عيادات البحيرة",
    template: "%s | حجز دكتور",
  },
  description:
    "احجز مع دكتور في عيادة قريبة منك، وشوف المواعيد المتاحة من غير حساب.",
};

export const viewport: Viewport = {
  themeColor: "#0f5f5c",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${tajawal.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
