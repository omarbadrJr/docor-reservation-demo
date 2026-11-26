"use client";

import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  BookingLookupForm,
  type LookupMode,
} from "@/components/booking/booking-lookup-form";
import { BookingLookupList } from "@/components/booking/booking-lookup-list";
import { ManagedBookingDetails } from "@/components/booking/managed-booking-details";
import { RescheduleBookingPanel } from "@/components/booking/reschedule-booking-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import type {
  BookingManagementErrorResponse,
  LookupAppointmentQuery,
  LookupAppointmentsResponse,
  ManagedBookingData,
  UpdateAppointmentResponse,
} from "@/types/booking";

const DEFAULT_CONNECTION_ERROR = "حصلت مشكلة في الاتصال، جرّب تاني.";

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function MyBookingManager() {
  const [mode, setMode] = useState<LookupMode>("reference");
  const [value, setValue] = useState("");
  const [lastQuery, setLastQuery] = useState<LookupAppointmentQuery | null>(
    null,
  );

  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [bookings, setBookings] = useState<ManagedBookingData[]>([]);
  const [todayDate, setTodayDate] = useState("");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"details" | "reschedule">("details");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const searchAbortRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
    };
  }, []);

  const selectedBooking =
    bookings.find((item) => item.id === selectedBookingId) ?? null;

  function handleModeChange(nextMode: LookupMode) {
    setMode(nextMode);
    setValue("");
    setFormError(null);
    setSearchError(null);
  }

  function handleValueChange(nextValue: string) {
    setValue(nextValue);
    if (formError) {
      setFormError(null);
    }
  }

  async function runLookup(query: LookupAppointmentQuery) {
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const requestId = ++searchRequestIdRef.current;

    setLastQuery(query);
    setIsSearching(true);
    setFormError(null);
    setSearchError(null);
    setFeedbackMessage(null);
    setViewMode("details");
    setIsCancelDialogOpen(false);
    setCancelError(null);

    const paramKey = query.type === "reference" ? "reference" : "phone";
    const paramValue =
      query.type === "reference" ? query.reference : query.phone;

    try {
      const response = await fetch(
        `/api/appointments/lookup?${paramKey}=${encodeURIComponent(paramValue)}`,
        { signal: controller.signal },
      );

      if (
        requestId !== searchRequestIdRef.current ||
        controller.signal.aborted
      ) {
        return;
      }

      if (!response.ok) {
        const errorData =
          await parseJsonSafe<BookingManagementErrorResponse>(response);
        const message = errorData?.error ?? DEFAULT_CONNECTION_ERROR;
        if (response.status === 400) {
          setFormError(message);
        } else {
          setSearchError(message);
        }
        return;
      }

      const data = await parseJsonSafe<LookupAppointmentsResponse>(response);
      if (
        requestId !== searchRequestIdRef.current ||
        controller.signal.aborted
      ) {
        return;
      }

      if (!data || !Array.isArray(data.bookings)) {
        setSearchError(DEFAULT_CONNECTION_ERROR);
        return;
      }

      setBookings(data.bookings);
      setTodayDate(data.todayDate);
      setHasSearched(true);
      setSelectedBookingId(
        data.bookings.length === 1 ? data.bookings[0].id : null,
      );
    } catch {
      if (
        requestId !== searchRequestIdRef.current ||
        controller.signal.aborted
      ) {
        return;
      }
      setSearchError(DEFAULT_CONNECTION_ERROR);
    } finally {
      if (
        requestId === searchRequestIdRef.current &&
        !controller.signal.aborted
      ) {
        setIsSearching(false);
      }
    }
  }

  function updateBookingInList(response: UpdateAppointmentResponse) {
    setBookings((current) =>
      current.map((item) =>
        item.id === response.booking.id ? response.booking : item,
      ),
    );
    setTodayDate(response.todayDate);
  }

  function handleRescheduled(response: UpdateAppointmentResponse) {
    updateBookingInList(response);
    setViewMode("details");
    setFeedbackMessage(
      "تم تغيير معاد حجزك بنجاح! المعاد القديم بقى متاح تاني واتسجل لك المعاد الجديد.",
    );
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function handleConfirmCancel() {
    if (!selectedBooking || isCancelling) {
      return;
    }

    setIsCancelling(true);
    setCancelError(null);

    try {
      const response = await fetch(
        `/api/appointments/${encodeURIComponent(selectedBooking.id)}/cancel`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            referenceNumber: selectedBooking.referenceNumber,
            patientPhone: selectedBooking.patientPhone,
          }),
        },
      );

      if (response.ok) {
        const data = await parseJsonSafe<UpdateAppointmentResponse>(response);
        if (data?.booking) {
          updateBookingInList(data);
          setIsCancelDialogOpen(false);
          setFeedbackMessage(
            "تم إلغاء الحجز بنجاح، والمعاد بقى متاح تاني.",
          );
          if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
          return;
        }
        setCancelError(DEFAULT_CONNECTION_ERROR);
        return;
      }

      const errorData =
        await parseJsonSafe<BookingManagementErrorResponse>(response);
      setCancelError(errorData?.error ?? DEFAULT_CONNECTION_ERROR);
    } catch {
      setCancelError(DEFAULT_CONNECTION_ERROR);
    } finally {
      setIsCancelling(false);
    }
  }

  if (selectedBooking && viewMode === "reschedule") {
    return (
      <div className="mt-8">
        <RescheduleBookingPanel
          booking={selectedBooking}
          todayDate={todayDate}
          onCancelReschedule={() => setViewMode("details")}
          onRescheduled={handleRescheduled}
        />
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="mx-auto w-full max-w-2xl">
        <BookingLookupForm
          mode={mode}
          value={value}
          isLoading={isSearching}
          error={formError}
          onModeChange={handleModeChange}
          onValueChange={handleValueChange}
          onSubmit={(query) => void runLookup(query)}
        />
      </div>

      {isSearching ? (
        <div className="mx-auto w-full max-w-2xl">
          <LoadingState
            title="بندور على حجزك..."
            description="استنى لحظة وهنطلع لك تفاصيل الحجز."
          />
        </div>
      ) : searchError ? (
        <div className="mx-auto w-full max-w-2xl">
          <ErrorState
            title="ما قدرناش نجيب بيانات الحجز"
            description={searchError}
            action={
              lastQuery ? (
                <Button
                  type="button"
                  onClick={() => void runLookup(lastQuery)}
                  className="min-h-11"
                >
                  جرّب تاني
                </Button>
              ) : null
            }
          />
        </div>
      ) : hasSearched && bookings.length === 0 ? (
        <div className="mx-auto w-full max-w-2xl">
          <EmptyState
            title="ما لقيناش حجز بالبيانات دي"
            description={
              lastQuery?.type === "reference"
                ? "اتأكد من رقم الحجز وجرّب تاني، أو دوّر برقم الموبايل اللي حجزت بيه."
                : "اتأكد من رقم الموبايل وجرّب تاني، أو اعمل حجز جديد."
            }
            action={
              <Link
                href="/specialties"
                className={buttonVariants({ variant: "default", size: "lg" })}
              >
                <CalendarPlus className="size-5" aria-hidden="true" />
                احجز عند دكتور
              </Link>
            }
          />
        </div>
      ) : selectedBooking ? (
        <ManagedBookingDetails
          booking={selectedBooking}
          showBackToList={bookings.length > 1}
          feedbackMessage={feedbackMessage}
          isCancelDialogOpen={isCancelDialogOpen}
          isCancelling={isCancelling}
          cancelError={cancelError}
          onBackToList={() => {
            setSelectedBookingId(null);
            setFeedbackMessage(null);
            setCancelError(null);
          }}
          onStartReschedule={() => {
            setFeedbackMessage(null);
            setCancelError(null);
            setViewMode("reschedule");
          }}
          onCancelDialogOpenChange={(open) => {
            setIsCancelDialogOpen(open);
            if (!open) {
              setCancelError(null);
            }
          }}
          onConfirmCancel={() => void handleConfirmCancel()}
        />
      ) : hasSearched && bookings.length > 1 ? (
        <div className="mx-auto w-full max-w-4xl">
          <BookingLookupList
            bookings={bookings}
            onSelectBooking={(bookingId) => {
              setSelectedBookingId(bookingId);
              setFeedbackMessage(null);
              setCancelError(null);
              if (typeof window !== "undefined") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
