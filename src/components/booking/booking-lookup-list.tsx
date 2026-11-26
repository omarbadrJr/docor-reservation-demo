"use client";

import { Building2, Calendar, Clock, ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BookingStatusBadge } from "@/components/ui/status-badge";
import { formatArabicDate } from "@/lib/format";
import { formatArabicTime } from "@/lib/schedule";
import type { ManagedBookingData } from "@/types/booking";

export type BookingLookupListProps = {
  bookings: ManagedBookingData[];
  onSelectBooking: (bookingId: string) => void;
};

export function BookingLookupList({
  bookings,
  onSelectBooking,
}: BookingLookupListProps) {
  return (
    <section
      aria-labelledby="booking-lookup-list-heading"
      className="space-y-4"
    >
      <div>
        <h2
          id="booking-lookup-list-heading"
          className="font-heading text-xl font-extrabold sm:text-2xl"
        >
          لقينا {bookings.length} حجوزات بالرقم ده
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          اختار الحجز اللي عايز تشوف تفاصيله أو تغيّر معاده أو تلغيه.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {bookings.map((booking) => (
          <li
            key={booking.id}
            className="flex flex-col justify-between rounded-md border border-border bg-card p-5"
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-border pb-3">
                <BookingStatusBadge status={booking.status} />
                <span
                  dir="ltr"
                  className="font-mono text-sm font-extrabold tracking-wide text-foreground"
                >
                  {booking.referenceNumber}
                </span>
              </div>

              <div>
                <p className="text-xs font-bold text-primary">
                  {booking.specialtyName}
                </p>
                <h3 className="mt-0.5 font-heading text-lg font-extrabold text-foreground">
                  {booking.doctorName}
                </h3>
              </div>

              <div className="space-y-1.5 text-sm text-foreground">
                <p className="flex items-center gap-2 font-semibold">
                  <Building2
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>{booking.clinicName}</span>
                </p>
                <p className="flex items-center gap-2 font-semibold">
                  <Calendar
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>{formatArabicDate(booking.appointmentDate)}</span>
                </p>
                <p className="flex items-center gap-2 font-semibold">
                  <Clock
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>
                    {formatArabicTime(booking.startTime)} -{" "}
                    {formatArabicTime(booking.endTime)}
                  </span>
                </p>
              </div>
            </div>

            <Button
              type="button"
              size="lg"
              onClick={() => onSelectBooking(booking.id)}
              className="mt-5 w-full"
            >
              <span>عرض تفاصيل الحجز</span>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
