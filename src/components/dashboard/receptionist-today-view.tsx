"use client";

import {
  AlertCircle,
  CalendarCheck2,
  CheckCheck,
  Clock,
  Search,
  Stamp,
  UserCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ReceptionistAppointmentCard } from "@/components/dashboard/receptionist-appointment-card";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/state";
import { formatArabicDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/types/database";
import type {
  ReceptionistAppointment,
  ReceptionistErrorResponse,
  ReceptionistStatusTarget,
  ReceptionistTodayDashboard,
} from "@/types/receptionist";

type StatusFilter = "ALL" | AppointmentStatus;

const STATUS_FILTER_OPTIONS: ReadonlyArray<{
  value: StatusFilter;
  label: string;
}> = [
  { value: "ALL", label: "الكل" },
  { value: "CONFIRMED", label: "مؤكد" },
  { value: "CHECKED_IN", label: "وصل العيادة" },
  { value: "COMPLETED", label: "خلص" },
  { value: "CANCELLED", label: "ملغي" },
  { value: "NO_SHOW", label: "ما حضرش" },
];

const ACTION_CONNECTION_ERROR =
  "حصلت مشكلة في الاتصال بالخادم، اتأكد من الإنترنت وحاول تاني.";

function normalizeDigits(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x0660),
    )
    .replace(/[\u06f0-\u06f9]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    );
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export interface ReceptionistTodayViewProps {
  initialDashboard: ReceptionistTodayDashboard;
}

export function ReceptionistTodayView({
  initialDashboard,
}: ReceptionistTodayViewProps) {
  const router = useRouter();
  const [prevInitialDashboard, setPrevInitialDashboard] =
    useState(initialDashboard);
  const [appointments, setAppointments] = useState<ReceptionistAppointment[]>(
    initialDashboard.appointments,
  );
  if (initialDashboard !== prevInitialDashboard) {
    setPrevInitialDashboard(initialDashboard);
    setAppointments(initialDashboard.appointments);
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    target: ReceptionistStatusTarget;
  } | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      setPendingAction(null);
      setBannerSuccess(null);
      setBannerError(null);
    };
  }, []);

  const confirmedCount = appointments.filter(
    (item) => item.status === "CONFIRMED",
  ).length;
  const checkedInCount = appointments.filter(
    (item) => item.status === "CHECKED_IN",
  ).length;
  const completedCount = appointments.filter(
    (item) => item.status === "COMPLETED",
  ).length;
  const noShowCount = appointments.filter(
    (item) => item.status === "NO_SHOW",
  ).length;
  const activeTotalCount =
    confirmedCount + checkedInCount + completedCount + noShowCount;

  const normalizedQuery = normalizeDigits(searchQuery).trim().toLowerCase();
  const filteredAppointments = appointments.filter((item) => {
    if (doctorFilter && item.doctorId !== doctorFilter) {
      return false;
    }
    if (statusFilter !== "ALL" && item.status !== statusFilter) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }

    const haystack = normalizeDigits(
      `${item.referenceNumber} ${item.patientName} ${item.patientPhone} ${item.doctorName}`,
    ).toLowerCase();
    return haystack.includes(normalizedQuery);
  });

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
        {
          method: "POST",
        },
      );

      const payload = await parseJsonSafe<
        { appointment?: ReceptionistAppointment } & Partial<ReceptionistErrorResponse>
      >(response);

      if (!response.ok || !payload?.appointment) {
        setBannerError(payload?.error ?? ACTION_CONNECTION_ERROR);
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
      setBannerError(ACTION_CONNECTION_ERROR);
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
        setBannerError(payload?.error ?? ACTION_CONNECTION_ERROR);
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
      setBannerError(ACTION_CONNECTION_ERROR);
    } finally {
      setPendingAction(null);
    }
  }

  const metricCards = [
    {
      id: "total",
      label: "إجمالي النهارده",
      value: activeTotalCount,
      subtitle: "حجز غير ملغي",
      icon: CalendarCheck2,
    },
    {
      id: "confirmed",
      label: "في الانتظار",
      value: confirmedCount,
      subtitle: "لسه ما وصلوش",
      icon: Clock,
    },
    {
      id: "checked-in",
      label: "وصلوا العيادة",
      value: checkedInCount,
      subtitle: "اتسجّل وصولهم",
      icon: UserCheck,
    },
    {
      id: "completed",
      label: "خلصوا الكشف",
      value: completedCount,
      subtitle: "حالات منتهية النهارده",
      icon: CheckCheck,
    },
  ];

  const isFiltered =
    normalizedQuery.length > 0 || doctorFilter !== "" || statusFilter !== "ALL";

  return (
    <div className="space-y-6">
      <PageHeader
        title="مواعيد النهارده"
        description={`${initialDashboard.clinicName} — ${formatArabicDate(initialDashboard.todayDate)}`}
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
          className="flex items-start justify-between gap-3 rounded-md border border-primary/35 bg-card px-4 py-3.5 text-sm leading-6 font-bold text-foreground"
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
          className="flex items-start justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-sm leading-6 font-semibold text-destructive"
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

      <section aria-labelledby="today-metrics-heading">
        <h2 id="today-metrics-heading" className="sr-only">
          ملخص مواعيد النهارده
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.id} className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-heading text-base font-extrabold text-foreground">
                    {card.label}
                  </h3>
                  <Icon
                    className="size-5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-3 font-heading text-3xl font-extrabold tabular-nums text-foreground">
                  {card.value}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {card.subtitle}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      {appointments.length > 0 ? (
        <Card>
          <CardContent className="space-y-4 pt-5 sm:pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="بحث سريع" htmlFor="today-appointments-search">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="today-appointments-search"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="رقم الحجز، اسم المريض، التليفون..."
                    className="pr-10 pl-13"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      aria-label="مسح البحث"
                      className="absolute top-1/2 left-1 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </Field>

              <Field label="الدكتور" htmlFor="today-appointments-doctor">
                <Select
                  id="today-appointments-doctor"
                  value={doctorFilter}
                  onChange={(event) => setDoctorFilter(event.target.value)}
                >
                  <option value="">كل دكاترة العيادة</option>
                  {initialDashboard.doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.fullName}
                      {doctor.isActive ? "" : " (غير نشط)"}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="flex flex-col gap-3 border-t border-dashed border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div
                role="group"
                aria-label="تصفية مواعيد النهارده حسب الحالة"
                className="flex flex-wrap gap-2"
              >
                {STATUS_FILTER_OPTIONS.map((option) => {
                  const selected = statusFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setStatusFilter(option.value)}
                      className={cn(
                        "inline-flex min-h-11 items-center rounded-md border px-3.5 text-sm font-bold transition-colors",
                        selected
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-card text-foreground hover:bg-muted",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <p className="text-sm font-semibold tabular-nums text-muted-foreground">
                معروض {filteredAppointments.length} من {appointments.length} حجز
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {appointments.length === 0 ? (
        <EmptyState
          title="مفيش حجوزات النهارده"
          description="أول ما مريض يحجز في العيادة ليوم النهارده هيظهر هنا على طول، وتقدر برضه تراجع كل الحجوزات السابقة والجاية."
          action={
            <Link
              href="/receptionist/appointments"
              className={buttonVariants({ variant: "outline", size: "default" })}
            >
              عرض كل الحجوزات
            </Link>
          }
        />
      ) : filteredAppointments.length === 0 ? (
        <EmptyState
          title="مفيش حجوزات مطابقة للبحث ده"
          description="جرّب تغيّر كلمة البحث أو الدكتور أو الحالة عشان تشوف باقي مواعيد النهارده."
          action={
            isFiltered ? (
              <button
                type="button"
                className={buttonVariants({
                  variant: "outline",
                  size: "default",
                })}
                onClick={() => {
                  setSearchQuery("");
                  setDoctorFilter("");
                  setStatusFilter("ALL");
                }}
              >
                عرض كل مواعيد النهارده
              </button>
            ) : null
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {filteredAppointments.map((appointment) => (
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
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
