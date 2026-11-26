"use client";

import {
  AlertCircle,
  CalendarClock,
  CalendarPlus,
  Camera,
  CheckCircle2,
  Loader2,
  Stamp,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import {
  AppointmentSlipFields,
  CopyReferenceButton,
} from "@/components/booking/appointment-slip-details";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookingStatusBadge } from "@/components/ui/status-badge";
import { formatArabicDate } from "@/lib/format";
import { formatArabicTime } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { ManagedBookingData } from "@/types/booking";

export type CancelBookingDialogContentProps = {
  booking: ManagedBookingData;
  isCancelling: boolean;
  error: string | null;
  onConfirmCancel: () => void;
};

export function CancelBookingDialogContent({
  booking,
  isCancelling,
  error,
  onConfirmCancel,
}: CancelBookingDialogContentProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>متأكد إنك عايز تلغي الحجز؟</DialogTitle>
        <DialogDescription>
          هتلغي معادك عند{" "}
          <span className="font-bold text-foreground">{booking.doctorName}</span>{" "}
          يوم{" "}
          <span className="font-bold text-foreground">
            {formatArabicDate(booking.appointmentDate)}
          </span>{" "}
          الساعة{" "}
          <span className="font-bold text-foreground">
            {formatArabicTime(booking.startTime)}
          </span>
          . لما تلغي الحجز، المعاد ده هيفضى فوراً وهيبقى متاح لحد تاني يحجزه.
        </DialogDescription>
      </DialogHeader>

      {error ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold leading-6 text-destructive"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      ) : null}

      <DialogFooter>
        <Button
          type="button"
          variant="destructive"
          size="lg"
          disabled={isCancelling}
          onClick={onConfirmCancel}
          className="w-full sm:w-auto"
        >
          {isCancelling ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              بنلغي الحجز...
            </>
          ) : (
            "أيوه، ألغي الحجز"
          )}
        </Button>

        <DialogClose
          disabled={isCancelling}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "w-full sm:w-auto",
          )}
        >
          لا، خليه زي ما هو
        </DialogClose>
      </DialogFooter>
    </>
  );
}

function getReadOnlyMessage(booking: ManagedBookingData): string {
  if (booking.status === "CANCELLED") {
    return "تم إلغاء الحجز ده والمعاد بقى متاح تاني. تقدر تحجز معاد جديد في أي وقت.";
  }
  if (booking.status === "CHECKED_IN") {
    return "تم تسجيل وصولك في العيادة للحجز ده، فما ينفعش تغيّره أو تلغيه من هنا.";
  }
  if (booking.status === "COMPLETED") {
    return "تم الكشف للحجز ده.";
  }
  if (booking.status === "NO_SHOW") {
    return "فات معاد الحجز ده وما تمش الحضور.";
  }
  return "معاد الحجز ده فات، ما ينفعش يتغيّر أو يتلغي دلوقتي.";
}

export type ManagedBookingDetailsProps = {
  booking: ManagedBookingData;
  showBackToList?: boolean;
  feedbackMessage?: string | null;
  isCancelDialogOpen?: boolean;
  isCancelling?: boolean;
  cancelError?: string | null;
  onBackToList?: () => void;
  onStartReschedule: () => void;
  onCancelDialogOpenChange: (open: boolean) => void;
  onConfirmCancel: () => void;
};

export function ManagedBookingDetails({
  booking,
  showBackToList = false,
  feedbackMessage = null,
  isCancelDialogOpen = false,
  isCancelling = false,
  cancelError = null,
  onBackToList,
  onStartReschedule,
  onCancelDialogOpenChange,
  onConfirmCancel,
}: ManagedBookingDetailsProps) {
  const showQrCode =
    booking.status === "CONFIRMED" || booking.status === "CHECKED_IN";
  const showActions = booking.canReschedule || booking.canCancel;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      {showBackToList && onBackToList ? (
        <button
          type="button"
          onClick={onBackToList}
          className="inline-flex min-h-11 cursor-pointer items-center text-sm font-bold text-primary hover:underline"
        >
          ← رجوع لكل حجوزاتك
        </button>
      ) : null}

      {feedbackMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2.5 rounded-md border border-primary/30 bg-primary/10 px-4 py-3.5 text-sm font-bold leading-6 text-foreground"
        >
          <CheckCircle2
            className="mt-0.5 size-5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <p>{feedbackMessage}</p>
        </div>
      ) : null}

      <article className="rounded-md border-2 border-foreground/25 bg-card p-2">
        <div className="border border-dashed border-foreground/30 p-5 sm:p-8">
          <header className="flex items-start justify-between gap-4 border-b border-dashed border-foreground/25 pb-5">
            <div>
              <BookingStatusBadge status={booking.status} />
              <h2 className="mt-3 font-heading text-2xl font-extrabold sm:text-3xl">
                تفاصيل حجزك
              </h2>
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

            {showQrCode ? (
              <>
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

                {booking.status === "CONFIRMED" && !booking.isPast ? (
                  <div className="mt-5 flex items-start gap-2.5 rounded-md border border-primary/25 bg-primary/10 px-4 py-3 text-right text-sm font-bold leading-6 text-foreground">
                    <Camera
                      className="mt-0.5 size-5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <p>
                      احفظ رقم الحجز أو الكود ده عشان هتحتاجه لما تروح العيادة.
                    </p>
                  </div>
                ) : null}
              </>
            ) : null}
          </section>

          <div
            className="my-6 border-t border-dashed border-foreground/25"
            aria-hidden="true"
          />

          <AppointmentSlipFields booking={booking} />

          <div className="mt-8 border-t border-border pt-6">
            {showActions ? (
              <div className="space-y-3">
                {booking.canCancel && !booking.isDoctorActive ? (
                  <p
                    role="status"
                    className="rounded-md border border-amber-700/30 bg-amber-700/10 px-4 py-3 text-sm font-bold leading-6 text-amber-900"
                  >
                    الدكتور ده غير متاح لتغيير المعاد دلوقتي، لكن تقدر تلغي
                    الحجز.
                  </p>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    variant="default"
                    size="lg"
                    disabled={!booking.canReschedule || isCancelling}
                    onClick={onStartReschedule}
                    className="w-full sm:flex-1"
                  >
                    <CalendarClock className="size-5" aria-hidden="true" />
                    غيّر معادك
                  </Button>

                  <Button
                    type="button"
                    variant="destructive"
                    size="lg"
                    disabled={!booking.canCancel || isCancelling}
                    onClick={() => onCancelDialogOpenChange(true)}
                    className="w-full sm:flex-1"
                  >
                    <XCircle className="size-5" aria-hidden="true" />
                    إلغاء الحجز
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p
                  role="status"
                  className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm font-bold leading-6 text-muted-foreground"
                >
                  {getReadOnlyMessage(booking)}
                </p>

                <Link
                  href="/specialties"
                  className={cn(
                    buttonVariants({ variant: "default", size: "lg" }),
                    "w-full sm:w-auto",
                  )}
                >
                  <CalendarPlus className="size-5" aria-hidden="true" />
                  احجز معاد جديد
                </Link>
              </div>
            )}
          </div>
        </div>
      </article>

      <Dialog
        open={isCancelDialogOpen}
        onOpenChange={(open) => {
          if (!isCancelling) {
            onCancelDialogOpenChange(open);
          }
        }}
      >
        <DialogContent>
          <CancelBookingDialogContent
            booking={booking}
            isCancelling={isCancelling}
            error={cancelError}
            onConfirmCancel={onConfirmCancel}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
