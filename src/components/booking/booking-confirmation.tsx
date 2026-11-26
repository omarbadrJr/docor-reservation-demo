"use client";

import { CalendarPlus, Camera, Search, Stamp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import {
  AppointmentSlipFields,
  CopyReferenceButton,
} from "@/components/booking/appointment-slip-details";
import { buttonVariants } from "@/components/ui/button";
import { BookingStatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import type { BookingConfirmationData } from "@/types/booking";

export type BookingConfirmationProps = {
  booking: BookingConfirmationData;
};

export function BookingConfirmation({ booking }: BookingConfirmationProps) {
  return (
    <article className="mx-auto w-full max-w-2xl rounded-md border-2 border-foreground/25 bg-card p-2">
      <div className="border border-dashed border-foreground/30 p-5 sm:p-8">
        <header className="flex items-start justify-between gap-4 border-b border-dashed border-foreground/25 pb-5">
          <div>
            <BookingStatusBadge status={booking.status} />
            <h1 className="mt-3 font-heading text-2xl font-extrabold sm:text-3xl">
              تم تأكيد حجزك!
            </h1>
          </div>
          <Stamp
            className="size-9 shrink-0 -rotate-6 text-primary"
            aria-hidden="true"
          />
        </header>

        <section className="mt-6 flex flex-col items-center rounded-md border border-border bg-background/60 p-5 text-center sm:p-6">
          <p className="text-sm font-bold text-muted-foreground">رقم الحجز</p>
          <p
            dir="ltr"
            className="mt-2 font-mono text-3xl font-extrabold tracking-wider text-foreground sm:text-4xl"
          >
            {booking.referenceNumber}
          </p>

          <CopyReferenceButton referenceNumber={booking.referenceNumber} />

          <div className="mt-6 rounded-md border border-border bg-white p-3">
            <Image
              src={booking.qrCodeDataUrl}
              alt={`كود QR للحجز رقم ${booking.referenceNumber}`}
              width={220}
              height={220}
              unoptimized
              className="size-[220px] max-w-full object-contain"
            />
          </div>

          <div className="mt-5 flex items-start gap-2.5 rounded-md border border-primary/25 bg-primary/10 px-4 py-3 text-right text-sm font-bold leading-6 text-foreground">
            <Camera
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p>
              خد سكرين شوت للصفحة دي أو احفظ رقم الحجز عشان هتحتاجه لما تروح
              العيادة.
            </p>
          </div>
        </section>

        <div
          className="my-6 border-t border-dashed border-foreground/25"
          aria-hidden="true"
        />

        <AppointmentSlipFields booking={booking} />

        <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
          <Link
            href="/my-booking"
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "w-full sm:flex-1",
            )}
          >
            <Search className="size-5" aria-hidden="true" />
            عندي حجز بالفعل
          </Link>
          <Link
            href="/specialties"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full sm:flex-1",
            )}
          >
            <CalendarPlus className="size-5" aria-hidden="true" />
            احجز عند دكتور تاني
          </Link>
        </div>
      </div>
    </article>
  );
}
