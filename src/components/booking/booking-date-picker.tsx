"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { AvailabilityStatusBadge } from "@/components/ui/status-badge";
import { dayOfWeek, shiftMonth } from "@/lib/cairo-time";
import { formatArabicDate, formatArabicMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AvailableDate } from "@/types/availability";

const saturdayFirstWeekdays = [
  "السبت",
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
] as const;

export type BookingDatePickerProps = {
  month: string;
  minMonth: string;
  todayDate: string;
  dates: AvailableDate[];
  selectedDate: string | null;
  isLoading: boolean;
  error: string | null;
  onSelectDate: (date: string) => void;
  onChangeMonth: (nextMonth: string) => void;
  onRetry: () => void;
};

export function BookingDatePicker({
  month,
  minMonth,
  todayDate,
  dates,
  selectedDate,
  isLoading,
  error,
  onSelectDate,
  onChangeMonth,
  onRetry,
}: BookingDatePickerProps) {
  const prevMonthDisabled = month <= minMonth;
  const leadingBlanks = (dayOfWeek(`${month}-01`) + 1) % 7;
  const hasAvailableDate = dates.some(
    (entry) => entry.date >= todayDate && entry.state === "AVAILABLE",
  );

  return (
    <section
      aria-labelledby="booking-date-heading"
      className="rounded-md border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-muted-foreground">اختار اليوم</p>
          <h2
            id="booking-date-heading"
            className="mt-1 font-heading text-xl font-extrabold sm:text-2xl"
          >
            {formatArabicMonth(month)}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1 sm:flex-initial"
            disabled={prevMonthDisabled}
            onClick={() => onChangeMonth(shiftMonth(month, -1))}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
            الشهر اللي فات
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1 sm:flex-initial"
            onClick={() => onChangeMonth(shiftMonth(month, 1))}
          >
            الشهر اللي جاي
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div
        className="mt-4 flex flex-wrap items-center gap-2 border-b border-dashed border-border pb-4"
        aria-label="دليل حالة الأيام"
      >
        <AvailabilityStatusBadge status="AVAILABLE" />
        <AvailabilityStatusBadge status="FULL" />
        <AvailabilityStatusBadge status="OFF" />
      </div>

      {isLoading ? (
        <LoadingState
          className="border-0 bg-transparent px-2 py-8"
          title="بنحمّل أيام الشهر..."
          description="استنى لحظة عشان نشوف الأيام المتاحة."
        />
      ) : error ? (
        <ErrorState
          className="mt-5 bg-background/40 py-8"
          title="ما قدرناش نحمّل الأيام"
          description={error}
          action={
            <Button type="button" onClick={onRetry} className="min-h-11">
              جرّب تاني
            </Button>
          }
        />
      ) : (
        <div className="mt-5">
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {saturdayFirstWeekdays.map((weekday) => (
              <div
                key={weekday}
                className="py-1.5 text-center text-xs font-extrabold text-muted-foreground sm:text-sm"
              >
                {weekday}
              </div>
            ))}

            {Array.from({ length: leadingBlanks }).map((_, index) => (
              <div key={`blank-${index}`} aria-hidden="true" />
            ))}

            {dates.map((entry) => {
              const dayNumber = Number(entry.date.split("-")[2]);
              const isPast = entry.date < todayDate;

              if (isPast) {
                return (
                  <button
                    key={entry.date}
                    type="button"
                    disabled
                    aria-label={`${formatArabicDate(entry.date)} - فات`}
                    className="flex min-h-14 w-full cursor-not-allowed flex-col items-center justify-center gap-0.5 rounded-md border border-border/60 bg-muted/40 px-1 py-2 text-center text-muted-foreground/75"
                  >
                    <span className="text-sm font-extrabold sm:text-base">
                      {dayNumber}
                    </span>
                    <span className="text-[11px] font-bold">فات</span>
                  </button>
                );
              }

              if (entry.state === "AVAILABLE") {
                const isSelected = selectedDate === entry.date;
                return (
                  <button
                    key={entry.date}
                    type="button"
                    onClick={() => onSelectDate(entry.date)}
                    aria-pressed={isSelected}
                    aria-label={`${formatArabicDate(entry.date)} - متاح`}
                    className={cn(
                      "flex min-h-14 w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-2 text-center transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-primary/35 bg-primary/10 text-foreground hover:border-primary hover:bg-primary/15",
                    )}
                  >
                    <span className="text-sm font-extrabold sm:text-base">
                      {dayNumber}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-bold",
                        isSelected ? "text-primary-foreground" : "text-primary",
                      )}
                    >
                      متاح
                    </span>
                  </button>
                );
              }

              if (entry.state === "FULL") {
                return (
                  <button
                    key={entry.date}
                    type="button"
                    disabled
                    aria-label={`${formatArabicDate(entry.date)} - مكتمل`}
                    className="flex min-h-14 w-full cursor-not-allowed flex-col items-center justify-center gap-0.5 rounded-md border border-amber-700/30 bg-amber-700/10 px-1 py-2 text-center text-amber-900"
                  >
                    <span className="text-sm font-extrabold sm:text-base">
                      {dayNumber}
                    </span>
                    <span className="text-[11px] font-bold">مكتمل</span>
                  </button>
                );
              }

              return (
                <button
                  key={entry.date}
                  type="button"
                  disabled
                  aria-label={`${formatArabicDate(entry.date)} - مقفول`}
                  className="flex min-h-14 w-full cursor-not-allowed flex-col items-center justify-center gap-0.5 rounded-md border border-border bg-background/60 px-1 py-2 text-center text-muted-foreground"
                >
                  <span className="text-sm font-extrabold sm:text-base">
                    {dayNumber}
                  </span>
                  <span className="text-[11px] font-bold">مقفول</span>
                </button>
              );
            })}
          </div>

          {!hasAvailableDate ? (
            <div
              role="status"
              className="mt-5 flex flex-col gap-3 rounded-md border border-dashed border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-sm font-bold leading-6 text-foreground">
                مفيش مواعيد فاضية في الشهر ده. جرّب الشهر اللي جاي.
              </p>
              <Button
                type="button"
                onClick={() => onChangeMonth(shiftMonth(month, 1))}
                className="min-h-11 shrink-0"
              >
                الشهر اللي جاي
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
