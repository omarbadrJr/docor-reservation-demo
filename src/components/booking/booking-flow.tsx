"use client";

import { AlertTriangle, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { BookingConfirmation } from "@/components/booking/booking-confirmation";
import { BookingDatePicker } from "@/components/booking/booking-date-picker";
import { BookingPatientForm } from "@/components/booking/booking-patient-form";
import { BookingSlotPicker } from "@/components/booking/booking-slot-picker";
import { DoctorPhoto } from "@/components/doctors/doctor-photo";
import { buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/state";
import { formatConsultationFee } from "@/lib/format";
import type { BookingFormValues } from "@/lib/validations/appointments";
import type {
  AvailabilityDateState,
  AvailableDate,
  DoctorAvailability,
  TimeSlot,
} from "@/types/availability";
import type {
  BookingConfirmationData,
  BookingDoctorSummary,
  CreateAppointmentErrorResponse,
  CreateAppointmentResponse,
} from "@/types/booking";

export type BookingFlowProps = {
  doctor: BookingDoctorSummary;
  todayDate: string;
  initialMonth: string;
  initialDates: AvailableDate[];
  initialSelectedDate: string | null;
  initialAvailability: DoctorAvailability | null;
};

type PatientFieldErrors = Partial<
  Record<"patientName" | "patientPhone", string>
>;

const DEFAULT_CONNECTION_ERROR = "حصلت مشكلة في الاتصال، جرّب تاني.";
const DEFAULT_DOCTOR_UNAVAILABLE_ERROR = "الدكتور ده غير متاح للحجز دلوقتي.";
const DEFAULT_SLOT_CONFLICT_ERROR =
  "المعاد ده اتحجز قبلك بشوية. اختار معاد تاني من المواعيد المتاحة.";
const DEFAULT_VALIDATION_ERROR =
  "بيانات الحجز مش مظبوطة، راجعها وحاول تاني.";

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function BookingFlow({
  doctor,
  todayDate,
  initialMonth,
  initialDates,
  initialSelectedDate,
  initialAvailability,
}: BookingFlowProps) {
  const [month, setMonth] = useState(initialMonth);
  const [dates, setDates] = useState<AvailableDate[]>(initialDates);
  const [isLoadingDates, setIsLoadingDates] = useState(false);
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
  const [fieldErrors, setFieldErrors] = useState<PatientFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [doctorUnavailableMessage, setDoctorUnavailableMessage] = useState<
    string | null
  >(null);
  const [confirmedBooking, setConfirmedBooking] =
    useState<BookingConfirmationData | null>(null);

  const monthAbortRef = useRef<AbortController | null>(null);
  const monthRequestIdRef = useRef(0);
  const dayAbortRef = useRef<AbortController | null>(null);
  const dayRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      monthAbortRef.current?.abort();
      dayAbortRef.current?.abort();
    };
  }, []);

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

  async function loadMonth(targetMonth: string) {
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
    setFieldErrors({});

    try {
      const response = await fetch(
        `/api/doctors/${encodeURIComponent(doctor.id)}/available-dates?month=${encodeURIComponent(targetMonth)}`,
        { signal: controller.signal },
      );

      if (requestId !== monthRequestIdRef.current || controller.signal.aborted) {
        return;
      }

      const data = await parseJsonSafe<{
        dates?: AvailableDate[];
        error?: string;
      }>(response);

      if (requestId !== monthRequestIdRef.current || controller.signal.aborted) {
        return;
      }

      if (response.status === 404) {
        setDoctorUnavailableMessage(
          data?.error ?? DEFAULT_DOCTOR_UNAVAILABLE_ERROR,
        );
        return;
      }

      if (!response.ok || !Array.isArray(data?.dates)) {
        setDatesError(data?.error ?? DEFAULT_CONNECTION_ERROR);
        return;
      }

      setDates(data.dates);
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
    setFieldErrors({});
    setSlotsError(null);
    setIsLoadingSlots(true);

    try {
      const response = await fetch(
        `/api/doctors/${encodeURIComponent(doctor.id)}/availability?date=${encodeURIComponent(date)}`,
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
        setDoctorUnavailableMessage(
          data?.error ?? DEFAULT_DOCTOR_UNAVAILABLE_ERROR,
        );
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

  function handleChangeMonth(nextMonth: string) {
    void loadMonth(nextMonth);
  }

  function handleSelectDate(date: string) {
    void loadDayAvailability(date);
  }

  function handleRetryDates() {
    void loadMonth(month);
  }

  function handleRetrySlots() {
    if (!selectedDate) {
      return;
    }
    void loadDayAvailability(selectedDate);
  }

  function handleSelectSlot(slot: TimeSlot) {
    setSelectedSlot(slot);
    setConflictError(null);
    setSubmitError(null);
    setFieldErrors({});
  }

  async function handleSubmitBooking(values: BookingFormValues) {
    if (!selectedDate || !selectedSlot || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setConflictError(null);
    setSubmitError(null);
    setFieldErrors({});

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          doctorId: doctor.id,
          appointmentDate: selectedDate,
          startTime: selectedSlot.start,
          patientName: values.patientName,
          patientPhone: values.patientPhone,
        }),
      });

      if (response.status === 201) {
        const data = await parseJsonSafe<CreateAppointmentResponse>(response);
        if (data?.booking) {
          setConfirmedBooking(data.booking);
          if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
          return;
        }
        setSubmitError(DEFAULT_CONNECTION_ERROR);
        return;
      }

      const errorData =
        await parseJsonSafe<CreateAppointmentErrorResponse>(response);

      if (response.status === 409) {
        setConflictError(errorData?.error ?? DEFAULT_SLOT_CONFLICT_ERROR);
        setSelectedSlot(null);

        if (errorData?.availability) {
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

      if (response.status === 404) {
        setDoctorUnavailableMessage(
          errorData?.error ?? DEFAULT_DOCTOR_UNAVAILABLE_ERROR,
        );
        return;
      }

      if (response.status === 400) {
        setSubmitError(errorData?.error ?? DEFAULT_VALIDATION_ERROR);
        setFieldErrors({
          patientName: errorData?.fieldErrors?.patientName,
          patientPhone: errorData?.fieldErrors?.patientPhone,
        });
        return;
      }

      setSubmitError(errorData?.error ?? DEFAULT_CONNECTION_ERROR);
    } catch {
      setSubmitError(DEFAULT_CONNECTION_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (confirmedBooking) {
    return (
      <div className="mt-8">
        <BookingConfirmation booking={confirmedBooking} />
      </div>
    );
  }

  if (doctorUnavailableMessage) {
    return (
      <ErrorState
        className="mt-8"
        title="الدكتور ده غير متاح دلوقتي"
        description={doctorUnavailableMessage}
        action={
          <Link
            href="/specialties"
            className={buttonVariants({ variant: "default", size: "default" })}
          >
            اختار التخصص
          </Link>
        }
      />
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <section
        aria-label="بيانات الدكتور"
        className="rounded-md border border-border bg-card p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <DoctorPhoto
              photoUrl={doctor.photoUrl}
              name={doctor.fullName}
              className="size-16 sm:size-20"
            />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-bold text-primary">
                {doctor.specialtyName}
              </p>
              <h2 className="font-heading text-xl font-extrabold text-foreground sm:text-2xl">
                {doctor.fullName}
              </h2>
              <p className="text-sm font-bold text-foreground">
                {doctor.clinicName}
              </p>
              <p className="flex items-start gap-1.5 text-sm leading-6 text-muted-foreground">
                <MapPin
                  className="mt-1 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>
                  <span className="font-bold text-foreground">
                    عنوان العيادة:
                  </span>{" "}
                  {doctor.clinicAddress}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-border pt-3 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
            <div className="text-sm sm:text-left">
              <span className="text-muted-foreground">الكشف: </span>
              <span className="text-base font-extrabold text-foreground">
                {formatConsultationFee(doctor.consultationFee)}
              </span>
            </div>
            <Link
              href={`/doctors/${encodeURIComponent(doctor.id)}`}
              className="inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline"
            >
              صفحة الدكتور
            </Link>
          </div>
        </div>
      </section>

      <BookingDatePicker
        month={month}
        minMonth={initialMonth}
        todayDate={todayDate}
        dates={dates}
        selectedDate={selectedDate}
        isLoading={isLoadingDates}
        error={datesError}
        onSelectDate={handleSelectDate}
        onChangeMonth={handleChangeMonth}
        onRetry={handleRetryDates}
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
        onSelectSlot={handleSelectSlot}
        onRetry={handleRetrySlots}
      />

      {selectedDate && selectedSlot ? (
        <BookingPatientForm
          key={`${selectedDate}-${selectedSlot.start}`}
          selectedDate={selectedDate}
          selectedSlot={selectedSlot}
          serverError={submitError}
          serverFieldErrors={fieldErrors}
          isSubmitting={isSubmitting}
          disabled={isLoadingDates || isLoadingSlots}
          onSubmit={handleSubmitBooking}
        />
      ) : null}
    </div>
  );
}
