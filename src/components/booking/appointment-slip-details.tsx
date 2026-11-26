"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatArabicDate, formatConsultationFee } from "@/lib/format";
import { formatArabicTime } from "@/lib/schedule";
import type { BookingConfirmationData } from "@/types/booking";

export function CopyReferenceButton({
  referenceNumber,
}: {
  referenceNumber: string;
}) {
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
      await navigator.clipboard.writeText(referenceNumber);
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
  );
}

export function AppointmentSlipFields({
  booking,
}: {
  booking: BookingConfirmationData;
}) {
  return (
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
  );
}
