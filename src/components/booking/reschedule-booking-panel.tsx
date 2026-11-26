"use client";

import { AlertTriangle, Calendar, Clock, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BookingDatePicker } from "@/components/booking/booking-date-picker";
import { BookingSlotPicker } from "@/components/booking/booking-slot-picker";
import { Button } from "@/components/ui/button";
import { formatArabicDate } from "@/lib/format";
import { formatArabicTime } from "@/lib/schedule";
import type {
  AvailabilityDateState,
  AvailableDate,
  DoctorAvailability,
  TimeSlot,
} from "@/types/availability";
import type {
  BookingManagementErrorResponse,
  ManagedBookingData,
  UpdateAppointmentResponse,
} from "@/types/booking";

export type RescheduleBookingPanelProps = {
  booking: ManagedBookingData;
  todayDate: string;
  initialMonth?: string;
  initialDates?: AvailableDate[];
  initialSelectedDate?: string | null;
  initialAvailability?: DoctorAvailability | null;
  onCancelReschedule: () => void;
  onRescheduled: (response: UpdateAppointmentResponse) => void;
};

const DEFAULT_CONNECTION_ERROR = "حصلت مشكلة في الاتصال، جرّب تاني.";
const DEFAULT_SLOT_CONFLICT_ERROR =
  "المعاد ده اتحجز قبلك بشوية. اختار معاد تاني من المواعيد المتاحة.";
const DEFAULT_DOCTOR_UNAVAILABLE_ERROR =
  "الدكتور ده غير متاح لتغيير المعاد دلوقتي.";

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchMonthDates(
  doctorId: string,
  targetMonth: string,
  signal: AbortSignal,
): Promise<{ dates: AvailableDate[] } | { error: string }> {
  const response = await fetch(
    `/api/doctors/${encodeURIComponent(doctorId)}/available-dates?month=${encodeURIComponent(targetMonth)}`,
    { signal },
  );
  const data = await parseJsonSafe<{
    dates?: AvailableDate[];
    error?: string;
  }>(response);

  if (response.status === 404) {
    return { error: data?.error ?? DEFAULT_DOCTOR_UNAVAILABLE_ERROR };
  }
  if (!response.ok || !Array.isArray(data?.dates)) {
    return { error: data?.error ?? DEFAULT_CONNECTION_ERROR };
  }
  return { dates: data.dates };
}

export function RescheduleBookingPanel({
  booking,
  todayDate,
  initialMonth,
  initialDates,
  initialSelectedDate = null,
  initialAvailability = null,
  onCancelReschedule,
  onRescheduled,
}: RescheduleBookingPanelProps) {
  const minMonth = todayDate.slice(0, 7);
  const startMonth = initialMonth ?? minMonth;

  const [month, setMonth] = useState(startMonth);
  const [dates, setDates] = useState<AvailableDate[]>(initialDates ?? []);
  const [isLoadingDates, setIsLoadingDates] = useState(
    initialDates === undefined,
  );
  const [datesError, setDatesError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(
    initialSelectedDate,
  );
  const [availability, setAvailability] = useState<DoctorAvailability | null>(
    initialAvailability,
  );
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const monthAbortRef = useRef<AbortController | null>(null);
  const monthRequestIdRef = useRef(0);
  const dayAbortRef = useRef<AbortController | null>(null);
  const dayRequestIdRef = useRef(0);

  function syncDateState(date: string, nextState: AvailabilityDateState) {
    setDates((current) => {
      const index = current.findIndex((entry) => entry.date === date);
      if (index === -1 || current[index].state === nextState) {
        return current;
      }
      const next = [...current];
      next[index] = { ...current[index], state: nextState };
      return next;
    });
  }

  async function loadDayAvailability(
    date: string,
    options?: { preserveConflictError?: boolean },
  ) {
    dayAbortRef.current?.abort();

    const controller = new AbortController();
    dayAbortRef.current = controller;
    const requestId = ++dayRequestIdRef.current;

    setSelectedDate(date);
    setSelectedSlot(null);
    if (!options?.preserveConflictError) {
      setConflictError(null);
    }
    setSubmitError(null);
    setSlotsError(null);
    setIsLoadingSlots(true);

    try {
      const response = await fetch(
        `/api/doctors/${encodeURIComponent(booking.doctorId)}/availability?date=${encodeURIComponent(date)}`,
        { signal: controller.signal },
      );

      if (requestId !== dayRequestIdRef.current || controller.signal.aborted) {
        return;
      }

      const data = await parseJsonSafe<{
        availability?: DoctorAvailability;
        error?: string;
      }>(response);

      if (requestId !== dayRequestIdRef.current || controller.signal.aborted) {
        return;
      }

      if (response.status === 404) {
        setAvailability(null);
        setSlotsError(data?.error ?? DEFAULT_DOCTOR_UNAVAILABLE_ERROR);
        return;
      }

      if (!response.ok || !data?.availability) {
        setAvailability(null);
        setSlotsError(data?.error ?? DEFAULT_CONNECTION_ERROR);
        return;
      }

      setAvailability(data.availability);
      syncDateState(date, data.availability.state);
    } catch {
      if (requestId !== dayRequestIdRef.current || controller.signal.aborted) {
        return;
      }
      setAvailability(null);
      setSlotsError(DEFAULT_CONNECTION_ERROR);
    } finally {
      if (requestId === dayRequestIdRef.current && !controller.signal.aborted) {
        setIsLoadingSlots(false);
      }
    }
  }

  async function runMonthFetch(
    targetMonth: string,
    controller: AbortController,
    requestId: number,
    autoSelectFirstAvailable: boolean,
  ) {
    try {
      const result = await fetchMonthDates(
        booking.doctorId,
        targetMonth,
        controller.signal,
      );

      if (requestId !== monthRequestIdRef.current || controller.signal.aborted) {
        return;
      }

      if ("error" in result) {
        setDatesError(result.error);
        return;
      }

      setDates(result.dates);

      if (autoSelectFirstAvailable) {
        const firstAvailable = result.dates.find(
          (entry) => entry.date >= todayDate && entry.state === "AVAILABLE",
        );
        if (firstAvailable) {
          void loadDayAvailability(firstAvailable.date);
        }
      }
    } catch {
      if (requestId !== monthRequestIdRef.current || controller.signal.aborted) {
        return;
      }
      setDatesError(DEFAULT_CONNECTION_ERROR);
    } finally {
      if (requestId === monthRequestIdRef.current && !controller.signal.aborted) {
        setIsLoadingDates(false);
      }
    }
  }

  function loadMonth(
    targetMonth: string,
    options?: { autoSelectFirstAvailable?: boolean },
  ) {
    monthAbortRef.current?.abort();
    dayAbortRef.current?.abort();

    const controller = new AbortController();
    monthAbortRef.current = controller;
    const requestId = ++monthRequestIdRef.current;
    dayRequestIdRef.current += 1;

    setMonth(targetMonth);
    setDates([]);
    setIsLoadingDates(true);
    setDatesError(null);
    setSelectedDate(null);
    setAvailability(null);
    setIsLoadingSlots(false);
    setSlotsError(null);
    setSelectedSlot(null);
    setConflictError(null);
    setSubmitError(null);

    void runMonthFetch(
      targetMonth,
      controller,
      requestId,
      Boolean(options?.autoSelectFirstAvailable),
    );
  }

  useEffect(() => {
    if (initialDates !== undefined) {
      return () => {
        monthAbortRef.current?.abort();
        dayAbortRef.current?.abort();
      };
    }

    const controller = new AbortController();
    monthAbortRef.current = controller;
    const requestId = ++monthRequestIdRef.current;

    void runMonthFetch(startMonth, controller, requestId, true);

    return () => {
      controller.abort();
      monthAbortRef.current?.abort();
      dayAbortRef.current?.abort();
    };
    // Initial fetch runs once on mount when initialDates is not provided.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConfirmReschedule() {
    if (!selectedDate || !selectedSlot || isSubmitting) {
      return;
    }

    if (
      selectedDate === booking.appointmentDate &&
      selectedSlot.start === booking.startTime
    ) {
      setSubmitError("ده نفس معادك الحالي، اختار يوم أو وقت تاني.");
      return;
    }

    setIsSubmitting(true);
    setConflictError(null);
    setSubmitError(null);

    try {
      const response = await fetch(
        `/api/appointments/${encodeURIComponent(booking.id)}/reschedule`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            referenceNumber: booking.referenceNumber,
            patientPhone: booking.patientPhone,
            appointmentDate: selectedDate,
            startTime: selectedSlot.start,
          }),
        },
      );

      if (response.ok) {
        const data = await parseJsonSafe<UpdateAppointmentResponse>(response);
        if (data?.booking) {
          onRescheduled(data);
          return;
        }
        setSubmitError(DEFAULT_CONNECTION_ERROR);
        return;
      }

      const errorData =
        await parseJsonSafe<BookingManagementErrorResponse>(response);

      if (response.status === 409 && errorData?.code === "SLOT_UNAVAILABLE") {
        setConflictError(errorData.error ?? DEFAULT_SLOT_CONFLICT_ERROR);
        setSelectedSlot(null);

        if (errorData.availability) {
          setAvailability(errorData.availability);
          setSlotsError(null);
          syncDateState(selectedDate, errorData.availability.state);
        } else {
          await loadDayAvailability(selectedDate, {
            preserveConflictError: true,
          });
        }
        return;
      }

      setSubmitError(errorData?.error ?? DEFAULT_CONNECTION_ERROR);
    } catch {
      setSubmitError(DEFAULT_CONNECTION_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <button
        type="button"
        disabled={isSubmitting}
        onClick={onCancelReschedule}
        className="inline-flex min-h-11 cursor-pointer items-center text-sm font-bold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60"
      >
        ← رجوع لتفاصيل الحجز
      </button>

      <section
        aria-label="المعاد الحالي للحجز"
        className="rounded-md border border-border bg-card p-5 sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-primary">
              تغيير معاد الحجز ({booking.referenceNumber})
            </p>
            <h2 className="mt-1 font-heading text-xl font-extrabold sm:text-2xl">
              {booking.doctorName}
            </h2>
            <p className="mt-0.5 text-sm font-semibold text-muted-foreground">
              {booking.specialtyName} — {booking.clinicName}
            </p>
          </div>

          <div className="rounded-md border border-border bg-background/70 px-4 py-3 text-sm">
            <p className="font-bold text-muted-foreground">معادك الحالي</p>
            <p className="mt-1 flex items-center gap-2 font-bold text-foreground">
              <Calendar className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{formatArabicDate(booking.appointmentDate)}</span>
            </p>
            <p className="mt-1 flex items-center gap-2 font-bold text-foreground">
              <Clock className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                {formatArabicTime(booking.startTime)} -{" "}
                {formatArabicTime(booking.endTime)}
              </span>
            </p>
          </div>
        </div>
      </section>

      <BookingDatePicker
        month={month}
        minMonth={minMonth}
        todayDate={todayDate}
        dates={dates}
        selectedDate={selectedDate}
        isLoading={isLoadingDates}
        error={datesError}
        onSelectDate={(date) => void loadDayAvailability(date)}
        onChangeMonth={(nextMonth) => void loadMonth(nextMonth)}
        onRetry={() => void loadMonth(month, { autoSelectFirstAvailable: true })}
      />

      {conflictError ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-md border border-destructive/35 bg-destructive/10 px-4 py-4 text-sm font-bold leading-6 text-destructive"
        >
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <p>{conflictError}</p>
        </div>
      ) : null}

      <BookingSlotPicker
        selectedDate={selectedDate}
        availability={availability}
        selectedSlot={selectedSlot}
        isLoading={isLoadingSlots}
        error={slotsError}
        onSelectSlot={(slot) => {
          setSelectedSlot(slot);
          setConflictError(null);
          setSubmitError(null);
        }}
        onRetry={() => {
          if (selectedDate) {
            void loadDayAvailability(selectedDate);
          }
        }}
      />

      {selectedDate && selectedSlot ? (
        <section
          aria-labelledby="reschedule-confirm-heading"
          className="rounded-md border-2 border-primary/35 bg-card p-5 sm:p-6"
        >
          <h2
            id="reschedule-confirm-heading"
            className="font-heading text-xl font-extrabold sm:text-2xl"
          >
            تأكيد المعاد الجديد
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            أول ما تأكّد، المعاد القديم هيفضى تلقائياً ويتسجل لك المعاد الجديد.
          </p>

          <div className="mt-4 grid gap-3 rounded-md border border-primary/25 bg-primary/10 p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-bold text-muted-foreground">المعاد القديم</p>
              <p className="mt-1 font-bold text-foreground">
                {formatArabicDate(booking.appointmentDate)} —{" "}
                {formatArabicTime(booking.startTime)}
              </p>
            </div>
            <div>
              <p className="font-bold text-primary">المعاد الجديد</p>
              <p className="mt-1 font-extrabold text-foreground">
                {formatArabicDate(selectedDate)} —{" "}
                {formatArabicTime(selectedSlot.start)} -{" "}
                {formatArabicTime(selectedSlot.end)}
              </p>
            </div>
          </div>

          {submitError ? (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold leading-6 text-destructive"
            >
              <AlertTriangle
                className="mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <p>{submitError}</p>
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              size="lg"
              disabled={isSubmitting || isLoadingDates || isLoadingSlots}
              onClick={() => void handleConfirmReschedule()}
              className="w-full sm:w-auto sm:min-w-52"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                  بنغيّر المعاد...
                </>
              ) : (
                "أكّد المعاد الجديد"
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isSubmitting}
              onClick={onCancelReschedule}
              className="w-full sm:w-auto"
            >
              رجوع
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
