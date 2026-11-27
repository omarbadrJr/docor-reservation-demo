"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { OwnerAppointmentSlip } from "@/components/dashboard/owner-overview";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { formatArabicDate } from "@/lib/format";
import type {
  OwnerAppointmentClinicOption,
  OwnerAppointmentDoctorOption,
} from "@/services/owner-appointments";
import type { AppointmentStatus } from "@/types/database";
import type { OwnerAppointment } from "@/types/owner";

type FilterState = {
  query: string;
  clinicId: string;
  doctorId: string;
  status: "" | AppointmentStatus;
  date: string;
};

const EMPTY_FILTERS: FilterState = {
  query: "",
  clinicId: "",
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
  "حصلت مشكلة وإحنا بنحمّل الحجوزات، جرّب تاني.";

function buildAppointmentsUrl(filters: FilterState): string {
  const params = new URLSearchParams();
  const trimmedQuery = filters.query.trim();

  if (trimmedQuery) {
    params.set("query", trimmedQuery);
  }
  if (filters.clinicId) {
    params.set("clinicId", filters.clinicId);
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
    ? `/api/owner/appointments?${queryString}`
    : "/api/owner/appointments";
}

export interface OwnerAppointmentsViewProps {
  initialAppointments: OwnerAppointment[];
  clinics: OwnerAppointmentClinicOption[];
  doctors: OwnerAppointmentDoctorOption[];
  initialTodayDate: string;
}

export function OwnerAppointmentsView({
  initialAppointments,
  clinics,
  doctors,
  initialTodayDate,
}: OwnerAppointmentsViewProps) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [prevInitialAppointments, setPrevInitialAppointments] =
    useState(initialAppointments);
  const [appointments, setAppointments] =
    useState<OwnerAppointment[]>(initialAppointments);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (initialAppointments !== prevInitialAppointments) {
    setPrevInitialAppointments(initialAppointments);
    const noActiveFilters = !(
      filters.query.trim() ||
      filters.clinicId ||
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

      let payload: { appointments?: OwnerAppointment[]; error?: string } | null =
        null;
      try {
        payload = (await response.json()) as {
          appointments?: OwnerAppointment[];
          error?: string;
        };
      } catch {
        payload = null;
      }

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

  function handleClinicChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const clinicId = event.target.value;
    const currentDoctor = doctors.find(
      (doctor) => doctor.id === filters.doctorId,
    );
    const shouldClearDoctor =
      clinicId !== "" &&
      currentDoctor !== undefined &&
      currentDoctor.clinicId !== clinicId;

    const nextFilters: FilterState = {
      ...filters,
      clinicId,
      doctorId: shouldClearDoctor ? "" : filters.doctorId,
    };

    setFilters(nextFilters);
    void fetchAppointments(nextFilters);
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

  const visibleDoctors = filters.clinicId
    ? doctors.filter((doctor) => doctor.clinicId === filters.clinicId)
    : doctors;

  const hasActiveFilters = Boolean(
    filters.query.trim() ||
      filters.clinicId ||
      filters.doctorId ||
      filters.status ||
      filters.date,
  );

  return (
    <div>
      <PageHeader
        title="الحجوزات"
        description="تابع وفلتر حجوزات كل العيادات والدكاترة من مكان واحد."
      />

      <Card className="mt-8">
        <form onSubmit={handleSearchSubmit} className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="بحث سريع"
              htmlFor="owner-appointments-query"
              className="sm:col-span-2 lg:col-span-1"
            >
              <Input
                id="owner-appointments-query"
                type="search"
                placeholder="رقم الحجز، اسم المريض، أو التليفون"
                value={filters.query}
                onChange={handleQueryChange}
              />
            </Field>

            <Field label="العيادة" htmlFor="owner-appointments-clinic">
              <Select
                id="owner-appointments-clinic"
                value={filters.clinicId}
                onChange={handleClinicChange}
              >
                <option value="">كل العيادات</option>
                {clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name}
                    {clinic.isActive ? "" : " (غير نشطة)"}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="الدكتور" htmlFor="owner-appointments-doctor">
              <Select
                id="owner-appointments-doctor"
                value={filters.doctorId}
                onChange={handleDoctorChange}
              >
                <option value="">كل الدكاترة</option>
                {visibleDoctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.fullName}
                    {doctor.isActive ? "" : " (غير نشط)"}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="حالة الحجز" htmlFor="owner-appointments-status">
              <Select
                id="owner-appointments-status"
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

            <Field label="التاريخ" htmlFor="owner-appointments-date">
              <Input
                id="owner-appointments-date"
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
        aria-labelledby="owner-appointments-results-heading"
        className="mt-8 space-y-4"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2
            id="owner-appointments-results-heading"
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
            description="استنى لحظة وبنعرض لك الحجوزات بعد الفلترة."
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
                : "لسه مفيش حجوزات مسجلة"
            }
            description={
              hasActiveFilters
                ? "جرّب تغيّر العيادة أو الدكتور أو التاريخ أو تمسح الفلاتر."
                : "أول ما مريض يحجز معاد في أي عيادة هيظهر هنا على طول."
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
                <OwnerAppointmentSlip appointment={appointment} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
