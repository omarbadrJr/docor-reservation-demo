"use client";

import { CalendarClock, CalendarX2, Check, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { formatArabicDate } from "@/lib/format";
import { formatArabicTime } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { DoctorAvailability, TimeSlot } from "@/types/availability";

export type BookingSlotPickerProps = {
  selectedDate: string | null;
  availability: DoctorAvailability | null;
  selectedSlot: TimeSlot | null;
  isLoading: boolean;
  error: string | null;
  onSelectSlot: (slot: TimeSlot) => void;
  onRetry: () => void;
};

export function BookingSlotPicker({
  selectedDate,
  availability,
  selectedSlot,
  isLoading,
  error,
  onSelectSlot,
  onRetry,
}: BookingSlotPickerProps) {
  return (
    <section
      aria-labelledby="booking-slots-heading"
      className="rounded-md border border-border bg-card p-5 sm:p-6"
    >
      <div>
        <h2
          id="booking-slots-heading"
          className="font-heading text-xl font-extrabold sm:text-2xl"
        >
          المواعيد المتاحة
        </h2>
        {selectedDate ? (
          <p className="mt-1 text-sm font-bold text-primary">
            {formatArabicDate(selectedDate)}
          </p>
        ) : null}
      </div>

      <div className="mt-4 border-t border-dashed border-border pt-5">
        {!selectedDate ? (
          <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm font-bold text-muted-foreground">
            <CalendarClock className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <p>اختار يوم متاح من فوق عشان تشوف المواعيد الفاضية.</p>
          </div>
        ) : isLoading ? (
          <LoadingState
            className="border-0 bg-transparent px-2 py-8"
            title="بنحمّل المواعيد المتاحة..."
            description="استنى لحظة وهتظهرلك كل الأوقات الفاضية."
          />
        ) : error ? (
          <ErrorState
            className="bg-background/40 py-8"
            title="ما قدرناش نحمّل المواعيد"
            description={error}
            action={
              <Button type="button" onClick={onRetry} className="min-h-11">
                جرّب تاني
              </Button>
            }
          />
        ) : availability?.state === "OFF" ? (
          <div
            role="status"
            className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm font-bold text-muted-foreground"
          >
            <CalendarX2 className="size-5 shrink-0" aria-hidden="true" />
            <p>الدكتور مش شغال في اليوم ده. اختار يوم تاني.</p>
          </div>
        ) : !availability ||
          availability.state === "FULL" ||
          availability.slots.length === 0 ? (
          <div
            role="status"
            className="flex items-center gap-3 rounded-md border border-amber-700/30 bg-amber-700/10 p-4 text-sm font-bold text-amber-900"
          >
            <Clock className="size-5 shrink-0" aria-hidden="true" />
            <p>كل مواعيد اليوم ده اتحجزت. اختار يوم تاني.</p>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            role="group"
            aria-label="المواعيد المتاحة"
          >
            {availability.slots.map((slot) => {
              const isSelected = selectedSlot?.start === slot.start;
              return (
                <button
                  key={`${slot.start}-${slot.end}`}
                  type="button"
                  onClick={() => onSelectSlot(slot)}
                  aria-pressed={isSelected}
                  className={cn(
                    "inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-base font-extrabold transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary/60 hover:bg-primary/5",
                  )}
                >
                  {isSelected ? (
                    <Check className="size-4 shrink-0" aria-hidden="true" />
                  ) : null}
                  <span>{formatArabicTime(slot.start)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
