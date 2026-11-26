"use client";

import { CalendarPlus, Camera, Check, Copy, Search, Stamp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { BookingStatusBadge } from "@/components/ui/status-badge";
import { formatArabicDate, formatConsultationFee } from "@/lib/format";
import { formatArabicTime } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { BookingConfirmationData } from "@/types/booking";

export type BookingConfirmationProps = {
  booking: BookingConfirmationData;
};

export function BookingConfirmation({ booking }: BookingConfirmationProps) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  async function handleCopyReference() {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(booking.referenceNumber);
      setCopied(true);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
      }, 2500);
    } catch {
      // Clipboard access can be denied in restricted browser contexts.
    }
  }

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

          <Button
            type="button"
            variant="outline"
            onClick={handleCopyReference}
            className="mt-4 min-h-11"
          >
            {copied ? (
              <>
                <Check className="size-4" aria-hidden="true" />
                اتنسخ!
              </>
            ) : (
              <>
                <Copy className="size-4" aria-hidden="true" />
                انسخ رقم الحجز
              </>
            )}
          </Button>

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

        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-bold text-muted-foreground">اسم المريض</dt>
            <dd className="mt-1 text-base font-extrabold text-foreground">
              {booking.patientName}
            </dd>
          </div>

          <div>
            <dt className="font-bold text-muted-foreground">رقم الموبايل</dt>
            <dd
              dir="ltr"
              className="mt-1 w-fit font-mono text-base font-bold text-foreground"
            >
              {booking.patientPhone}
            </dd>
          </div>

          <div>
            <dt className="font-bold text-muted-foreground">الدكتور</dt>
            <dd className="mt-1 text-base font-extrabold text-foreground">
              {booking.doctorName}
            </dd>
          </div>

          <div>
            <dt className="font-bold text-muted-foreground">التخصص</dt>
            <dd className="mt-1 text-base font-bold text-foreground">
              {booking.specialtyName}
            </dd>
          </div>

          <div>
            <dt className="font-bold text-muted-foreground">اسم العيادة</dt>
            <dd className="mt-1 text-base font-bold text-foreground">
              {booking.clinicName}
            </dd>
          </div>

          <div>
            <dt className="font-bold text-muted-foreground">عنوان العيادة</dt>
            <dd className="mt-1 leading-7 text-foreground">
              {booking.clinicAddress}
            </dd>
          </div>

          <div>
            <dt className="font-bold text-muted-foreground">تاريخ الحجز</dt>
            <dd className="mt-1 text-base font-bold text-foreground">
              {formatArabicDate(booking.appointmentDate)}
            </dd>
          </div>

          <div>
            <dt className="font-bold text-muted-foreground">معاد الحجز</dt>
            <dd className="mt-1 text-base font-bold text-foreground">
              {formatArabicTime(booking.startTime)} -{" "}
              {formatArabicTime(booking.endTime)}
            </dd>
          </div>

          <div>
            <dt className="font-bold text-muted-foreground">الكشف</dt>
            <dd className="mt-1 text-base font-extrabold text-foreground">
              {formatConsultationFee(booking.consultationFee)}
            </dd>
          </div>
        </dl>

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
