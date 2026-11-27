"use client";

import { AlertCircle, Stamp, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ReceptionistAppointmentCard } from "@/components/dashboard/receptionist-appointment-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { formatArabicDate } from "@/lib/format";
import type { AppointmentStatus } from "@/types/database";
import type {
  ReceptionistAppointment,
  ReceptionistDoctorOption,
  ReceptionistErrorResponse,
  ReceptionistStatusTarget,
} from "@/types/receptionist";

type FilterState = {
  query: string;
  doctorId: string;
  status: "" | AppointmentStatus;
  date: string;
};

const EMPTY_FILTERS: FilterState = {
  query: "",
  doctorId: "",
  status: "",
  date: "",
};

const STATUS_OPTIONS: Array<{ value: AppointmentStatus; label: string }> = [
  { value: "CONFIRMED", label: "مؤكد" },
  { value: "CHECKED_IN", label: "وصل العيادة" },
  { value: "COMPLETED", label: "خلص" },
  { value: "CANCELLED", label: "ملغي" },
  { value: "NO_SHOW", label: "ما حضرش" },
];

const FETCH_APPOINTMENTS_FALLBACK_ERROR =
  "حصلت مشكلة وإحنا بنحمّل حجوزات العيادة، جرّب تاني.";
const ACTION_FALLBACK_ERROR =
  "حصلت مشكلة وإحنا بنحدّث الحجز، اتأكد من الاتصال وحاول تاني.";

function buildAppointmentsUrl(filters: FilterState): string {
  const params = new URLSearchParams();
  const trimmedQuery = filters.query.trim();

  if (trimmedQuery) {
    params.set("query", trimmedQuery);
  }
  if (filters.doctorId) {
    params.set("doctorId", filters.doctorId);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.date) {
    params.set("date", filters.date);
  }

  const queryString = params.toString();
  return queryString
    ? `/api/receptionist/appointments?${queryString}`
    : "/api/receptionist/appointments";
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export interface ReceptionistAppointmentsViewProps {
  initialAppointments: ReceptionistAppointment[];
  doctors: ReceptionistDoctorOption[];
  clinicName: string;
  initialTodayDate: string;
}

export function ReceptionistAppointmentsView({
  initialAppointments,
  doctors,
  clinicName,
  initialTodayDate,
}: ReceptionistAppointmentsViewProps) {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [prevInitialAppointments, setPrevInitialAppointments] =
    useState(initialAppointments);
  const [appointments, setAppointments] =
    useState<ReceptionistAppointment[]>(initialAppointments);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    target: ReceptionistStatusTarget;
  } | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  if (initialAppointments !== prevInitialAppointments) {
    setPrevInitialAppointments(initialAppointments);
    const noActiveFilters = !(
      filters.query.trim() ||
      filters.doctorId ||
      filters.status ||
      filters.date
    );
    if (noActiveFilters) {
      setAppointments(initialAppointments);
    }
  }

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSequenceRef = useRef(0);
  const inFlightRef = useRef(false);
  const pendingDebounceRef = useRef(false);
  const needsResyncRef = useRef(false);
  const filtersRef = useRef<FilterState>(EMPTY_FILTERS);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const fetchAppointments = useCallback(async (nextFilters: FilterState) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingDebounceRef.current = false;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    requestSequenceRef.current += 1;
    const sequence = requestSequenceRef.current;

    inFlightRef.current = true;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(buildAppointmentsUrl(nextFilters), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });

      const payload = await parseJsonSafe<
        { appointments?: ReceptionistAppointment[] } & Partial<ReceptionistErrorResponse>
      >(response);

      if (controller.signal.aborted || sequence !== requestSequenceRef.current) {
        return;
      }

      if (!response.ok) {
        setErrorMessage(payload?.error || FETCH_APPOINTMENTS_FALLBACK_ERROR);
        return;
      }

      setAppointments(
        Array.isArray(payload?.appointments) ? payload.appointments : [],
      );
    } catch (error) {
      if (
        (error instanceof Error && error.name === "AbortError") ||
        controller.signal.aborted ||
        sequence !== requestSequenceRef.current
      ) {
        return;
      }

      setErrorMessage(FETCH_APPOINTMENTS_FALLBACK_ERROR);
    } finally {
      if (
        !controller.signal.aborted &&
        sequence === requestSequenceRef.current
      ) {
        inFlightRef.current = false;
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (needsResyncRef.current) {
      needsResyncRef.current = false;
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void fetchAppointments(filtersRef.current);
      }, 0);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
        if (pendingDebounceRef.current) {
          pendingDebounceRef.current = false;
          needsResyncRef.current = true;
        }
      }
      if (inFlightRef.current) {
        inFlightRef.current = false;
        needsResyncRef.current = true;
      }
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setPendingAction(null);
      setBannerSuccess(null);
      setBannerError(null);
    };
  }, [fetchAppointments]);

  function handleQueryChange(event: React.ChangeEvent<HTMLInputElement>) {
    const query = event.target.value;
    const nextFilters = { ...filters, query };
    setFilters(nextFilters);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    pendingDebounceRef.current = true;
    debounceTimerRef.current = setTimeout(() => {
      pendingDebounceRef.current = false;
      debounceTimerRef.current = null;
      void fetchAppointments(nextFilters);
    }, 300);
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void fetchAppointments(filters);
  }

  function handleDoctorChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextFilters: FilterState = {
      ...filters,
      doctorId: event.target.value,
    };
    setFilters(nextFilters);
    void fetchAppointments(nextFilters);
  }

  function handleStatusChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextFilters: FilterState = {
      ...filters,
      status: event.target.value as "" | AppointmentStatus,
    };
    setFilters(nextFilters);
    void fetchAppointments(nextFilters);
  }

  function handleDateChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFilters: FilterState = {
      ...filters,
      date: event.target.value,
    };
    setFilters(nextFilters);
    void fetchAppointments(nextFilters);
  }

  function handleShowToday() {
    const nextFilters: FilterState = {
      ...filters,
      date: initialTodayDate,
    };
    setFilters(nextFilters);
    void fetchAppointments(nextFilters);
  }

  function handleShowAllDates() {
    const nextFilters: FilterState = {
      ...filters,
      date: "",
    };
    setFilters(nextFilters);
    void fetchAppointments(nextFilters);
  }

  function handleResetFilters() {
    setFilters(EMPTY_FILTERS);
    void fetchAppointments(EMPTY_FILTERS);
  }

  async function handleCheckIn(appointment: ReceptionistAppointment) {
    if (pendingAction) {
      return;
    }

    setBannerSuccess(null);
    setBannerError(null);
    setPendingAction({ id: appointment.id, target: "CHECKED_IN" });

    try {
      const response = await fetch(
        `/api/receptionist/appointments/${encodeURIComponent(appointment.referenceNumber)}/check-in`,
        { method: "POST" },
      );

      const payload = await parseJsonSafe<
        { appointment?: ReceptionistAppointment } & Partial<ReceptionistErrorResponse>
      >(response);

      if (!response.ok || !payload?.appointment) {
        setBannerError(payload?.error ?? ACTION_FALLBACK_ERROR);
        return;
      }

      const updated = payload.appointment;
      setAppointments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setBannerSuccess(
        `تم تسجيل وصول "${updated.patientName}" (${updated.referenceNumber}) بنجاح.`,
      );
      router.refresh();
    } catch {
      setBannerError(ACTION_FALLBACK_ERROR);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUpdateStatus(
    appointment: ReceptionistAppointment,
    targetStatus: Exclude<ReceptionistStatusTarget, "CHECKED_IN">,
  ) {
    if (pendingAction) {
      return;
    }

    setBannerSuccess(null);
    setBannerError(null);
    setPendingAction({ id: appointment.id, target: targetStatus });

    try {
      const response = await fetch(
        `/api/receptionist/appointments/${encodeURIComponent(appointment.referenceNumber)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        },
      );

      const payload = await parseJsonSafe<
        { appointment?: ReceptionistAppointment } & Partial<ReceptionistErrorResponse>
      >(response);

      if (!response.ok || !payload?.appointment) {
        setBannerError(payload?.error ?? ACTION_FALLBACK_ERROR);
        return;
      }

      const updated = payload.appointment;
      setAppointments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setBannerSuccess(
        targetStatus === "COMPLETED"
          ? `تم إنهاء كشف "${updated.patientName}" (${updated.referenceNumber}).`
          : `تم تسجيل "${updated.patientName}" (${updated.referenceNumber}) كـ ما حضرش.`,
      );
      router.refresh();
    } catch {
      setBannerError(ACTION_FALLBACK_ERROR);
    } finally {
      setPendingAction(null);
    }
  }

  const hasActiveFilters = Boolean(
    filters.query.trim() || filters.doctorId || filters.status || filters.date,
  );

  return (
    <div>
      <PageHeader
        title="كل حجوزات العيادة"
        description={`${clinicName} — دوّر برقم الحجز أو الموبايل أو فلتر بالدكتور والتاريخ.`}
        action={
          <Link
            href="/receptionist/check-in"
            className={buttonVariants({ variant: "default", size: "default" })}
          >
            تسجيل وصول / مسح كود
          </Link>
        }
      />

      {bannerSuccess ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-6 flex items-start justify-between gap-3 rounded-md border border-primary/35 bg-card px-4 py-3.5 text-sm leading-6 font-bold text-foreground"
        >
          <div className="flex items-start gap-2.5">
            <Stamp
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p>{bannerSuccess}</p>
          </div>
          <button
            type="button"
            onClick={() => setBannerSuccess(null)}
            aria-label="إخفاء الرسالة"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {bannerError ? (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-6 flex items-start justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-sm leading-6 font-semibold text-destructive"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle
              className="mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            <p>{bannerError}</p>
          </div>
          <button
            type="button"
            onClick={() => setBannerError(null)}
            aria-label="إخفاء رسالة الخطأ"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-destructive hover:bg-destructive/15"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <Card className="mt-8">
        <form onSubmit={handleSearchSubmit} className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="بحث برقم الحجز أو المريض" htmlFor="receptionist-appointments-query">
              <Input
                id="receptionist-appointments-query"
                type="search"
                placeholder="مثال: DR-8K29P4 أو اسم المريض"
                value={filters.query}
                onChange={handleQueryChange}
              />
            </Field>

            <Field label="الدكتور" htmlFor="receptionist-appointments-doctor">
              <Select
                id="receptionist-appointments-doctor"
                value={filters.doctorId}
                onChange={handleDoctorChange}
              >
                <option value="">كل دكاترة العيادة</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.fullName}
                    {doctor.isActive ? "" : " (غير نشط)"}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="حالة الحجز" htmlFor="receptionist-appointments-status">
              <Select
                id="receptionist-appointments-status"
                value={filters.status}
                onChange={handleStatusChange}
              >
                <option value="">الكل</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="التاريخ" htmlFor="receptionist-appointments-date">
              <Input
                id="receptionist-appointments-date"
                type="date"
                dir="ltr"
                value={filters.date}
                onChange={handleDateChange}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-dashed border-border pt-4">
            <Button type="submit">بحث</Button>

            <Button
              type="button"
              variant={
                filters.date === initialTodayDate ? "secondary" : "outline"
              }
              onClick={handleShowToday}
            >
              حجوزات النهارده
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleShowAllDates}
              disabled={!filters.date}
            >
              عرض كل التواريخ
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
            >
              إعادة ضبط الفلاتر
            </Button>
          </div>
        </form>
      </Card>

      <section
        aria-labelledby="receptionist-appointments-results-heading"
        className="mt-8 space-y-4"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2
            id="receptionist-appointments-results-heading"
            className="font-heading text-xl font-extrabold text-foreground"
          >
            نتايج الحجوزات
          </h2>
          <p className="text-sm font-semibold tabular-nums text-muted-foreground">
            إجمالي {appointments.length} حجز
            {filters.date ? ` — ${formatArabicDate(filters.date)}` : ""}
          </p>
        </div>

        {isLoading ? (
          <LoadingState
            title="بنحمّل الحجوزات..."
            description="استنى لحظة وبنعرض لك حجوزات العيادة."
          />
        ) : errorMessage ? (
          <ErrorState
            title="ما قدرناش نحمّل الحجوزات"
            description={errorMessage}
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => void fetchAppointments(filters)}
              >
                جرّب تاني
              </Button>
            }
          />
        ) : appointments.length === 0 ? (
          <EmptyState
            title={
              hasActiveFilters
                ? "مفيش حجوزات مطابقة للبحث ده"
                : "لسه مفيش حجوزات في العيادة"
            }
            description={
              hasActiveFilters
                ? "جرّب تغيّر رقم الحجز أو الدكتور أو التاريخ أو تمسح الفلاتر."
                : "أول ما مريض يحجز معاد في العيادة هيظهر هنا على طول."
            }
            action={
              hasActiveFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResetFilters}
                >
                  إعادة ضبط الفلاتر
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {appointments.map((appointment) => (
              <li key={appointment.id}>
                <ReceptionistAppointmentCard
                  appointment={appointment}
                  pendingAction={
                    pendingAction?.id === appointment.id
                      ? pendingAction.target
                      : null
                  }
                  disableActions={pendingAction !== null}
                  onCheckIn={handleCheckIn}
                  onUpdateStatus={handleUpdateStatus}
                  showCheckInLink
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
