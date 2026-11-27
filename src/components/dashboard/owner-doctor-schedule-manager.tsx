"use client";

import {
  AlertCircle,
  CalendarOff,
  CalendarPlus,
  Clock,
  Loader2,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Stamp,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { ActiveStatusBadge } from "@/components/dashboard/active-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatArabicDate } from "@/lib/format";
import { formatArabicTime } from "@/lib/schedule";
import {
  parseCreateManualAvailabilityInput,
  parseCreateScheduleExceptionInput,
  parseCreateWeeklyScheduleInput,
  parseUpdateWeeklyScheduleInput,
} from "@/lib/validations/owner";
import type { ScheduleExceptionType } from "@/types/database";
import type {
  OwnerDoctorSchedules,
  OwnerErrorResponse,
  OwnerManualAvailability,
  OwnerScheduleException,
  OwnerWeeklySchedule,
} from "@/types/owner";

const WEEKDAY_OPTIONS = [
  { value: 0, label: "الأحد" },
  { value: 1, label: "الاثنين" },
  { value: 2, label: "الثلاثاء" },
  { value: 3, label: "الأربعاء" },
  { value: 4, label: "الخميس" },
  { value: 5, label: "الجمعة" },
  { value: 6, label: "السبت" },
] as const;

const EXCEPTION_TYPE_OPTIONS: ReadonlyArray<{
  value: ScheduleExceptionType;
  label: string;
}> = [
  { value: "CLOSED", label: "يوم مقفول / إجازة" },
  { value: "MODIFIED_HOURS", label: "تعديل ساعات العمل في اليوم ده" },
  { value: "EXTRA_HOURS", label: "ساعات عمل إضافية" },
];

const DEFAULT_CONNECTION_ERROR =
  "حصلت مشكلة في الاتصال، تأكد من الإنترنت وحاول تاني.";

type SectionBanner = {
  type: "success" | "error";
  message: string;
};

function getWeekdayLabel(dayOfWeek: number): string {
  return (
    WEEKDAY_OPTIONS.find((option) => option.value === dayOfWeek)?.label ??
    "يوم غير محدد"
  );
}

function sortWeeklySchedules(
  items: OwnerWeeklySchedule[],
): OwnerWeeklySchedule[] {
  return [...items].sort(
    (first, second) =>
      first.dayOfWeek - second.dayOfWeek ||
      first.startTime.localeCompare(second.startTime) ||
      first.endTime.localeCompare(second.endTime),
  );
}

function sortManualAvailabilities(
  items: OwnerManualAvailability[],
): OwnerManualAvailability[] {
  return [...items].sort(
    (first, second) =>
      first.availabilityDate.localeCompare(second.availabilityDate) ||
      first.startTime.localeCompare(second.startTime) ||
      first.endTime.localeCompare(second.endTime),
  );
}

function sortScheduleExceptions(
  items: OwnerScheduleException[],
): OwnerScheduleException[] {
  return [...items].sort(
    (first, second) =>
      first.exceptionDate.localeCompare(second.exceptionDate) ||
      first.createdAt.localeCompare(second.createdAt),
  );
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function SectionAlert({ banner }: { banner: SectionBanner | null }) {
  if (!banner) {
    return null;
  }

  if (banner.type === "error") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="mb-5 flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 font-semibold text-destructive"
      >
        <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p>{banner.message}</p>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-5 flex items-start gap-2.5 rounded-md border border-primary/35 bg-card px-4 py-3 text-sm leading-6 font-bold text-foreground"
    >
      <Stamp
        className="mt-0.5 size-5 shrink-0 text-primary"
        aria-hidden="true"
      />
      <p>{banner.message}</p>
    </div>
  );
}

function ExceptionTypeBadge({
  exceptionType,
}: {
  exceptionType: ScheduleExceptionType;
}) {
  if (exceptionType === "CLOSED") {
    return (
      <Badge variant="destructive">
        <CalendarOff className="size-3.5" aria-hidden="true" />
        يوم مقفول / إجازة
      </Badge>
    );
  }

  if (exceptionType === "MODIFIED_HOURS") {
    return (
      <Badge variant="warning">
        <Clock className="size-3.5" aria-hidden="true" />
        تعديل ساعات العمل
      </Badge>
    );
  }

  return (
    <Badge variant="default">
      <CalendarPlus className="size-3.5" aria-hidden="true" />
      ساعات عمل إضافية
    </Badge>
  );
}

export function OwnerDoctorScheduleManager({
  initialData,
}: {
  initialData: OwnerDoctorSchedules;
}) {
  const router = useRouter();
  const { doctor } = initialData;
  const [prevInitialData, setPrevInitialData] = useState(initialData);

  const [weeklySchedules, setWeeklySchedules] = useState<OwnerWeeklySchedule[]>(
    () => sortWeeklySchedules(initialData.weeklySchedules),
  );
  const [manualAvailabilities, setManualAvailabilities] = useState<
    OwnerManualAvailability[]
  >(() => sortManualAvailabilities(initialData.manualAvailabilities));
  const [scheduleExceptions, setScheduleExceptions] = useState<
    OwnerScheduleException[]
  >(() => sortScheduleExceptions(initialData.scheduleExceptions));

  if (initialData !== prevInitialData) {
    setPrevInitialData(initialData);
    setWeeklySchedules(sortWeeklySchedules(initialData.weeklySchedules));
    setManualAvailabilities(
      sortManualAvailabilities(initialData.manualAvailabilities),
    );
    setScheduleExceptions(
      sortScheduleExceptions(initialData.scheduleExceptions),
    );
  }

  // Weekly schedule form & action states
  const [weeklyDay, setWeeklyDay] = useState<string>("0");
  const [weeklyStartTime, setWeeklyStartTime] = useState<string>("09:00");
  const [weeklyEndTime, setWeeklyEndTime] = useState<string>("17:00");
  const [weeklyFieldErrors, setWeeklyFieldErrors] = useState<
    Record<string, string>
  >({});
  const [weeklyBanner, setWeeklyBanner] = useState<SectionBanner | null>(null);
  const [isCreatingWeekly, setIsCreatingWeekly] = useState(false);
  const [pendingWeeklyAction, setPendingWeeklyAction] = useState<{
    id: string;
    action: "toggle" | "delete";
  } | null>(null);
  const [editingWeeklyId, setEditingWeeklyId] = useState<string | null>(null);
  const [editWeeklyDay, setEditWeeklyDay] = useState<string>("0");
  const [editWeeklyStartTime, setEditWeeklyStartTime] =
    useState<string>("09:00");
  const [editWeeklyEndTime, setEditWeeklyEndTime] = useState<string>("17:00");
  const [editWeeklyFieldErrors, setEditWeeklyFieldErrors] = useState<
    Record<string, string>
  >({});
  const [isSavingWeeklyEdit, setIsSavingWeeklyEdit] = useState(false);

  // Manual availability form & action states
  const [manualDate, setManualDate] = useState<string>("");
  const [manualStartTime, setManualStartTime] = useState<string>("18:00");
  const [manualEndTime, setManualEndTime] = useState<string>("21:00");
  const [manualFieldErrors, setManualFieldErrors] = useState<
    Record<string, string>
  >({});
  const [manualBanner, setManualBanner] = useState<SectionBanner | null>(null);
  const [isCreatingManual, setIsCreatingManual] = useState(false);
  const [pendingManualId, setPendingManualId] = useState<string | null>(null);

  // Schedule exception form & action states
  const [exceptionDate, setExceptionDate] = useState<string>("");
  const [exceptionType, setExceptionType] =
    useState<ScheduleExceptionType>("CLOSED");
  const [exceptionStartTime, setExceptionStartTime] = useState<string>("10:00");
  const [exceptionEndTime, setExceptionEndTime] = useState<string>("14:00");
  const [exceptionReason, setExceptionReason] = useState<string>("");
  const [exceptionFieldErrors, setExceptionFieldErrors] = useState<
    Record<string, string>
  >({});
  const [exceptionBanner, setExceptionBanner] = useState<SectionBanner | null>(
    null,
  );
  const [isCreatingException, setIsCreatingException] = useState(false);
  const [pendingExceptionId, setPendingExceptionId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    return () => {
      setWeeklyBanner(null);
      setManualBanner(null);
      setExceptionBanner(null);
      setEditingWeeklyId(null);
      setEditWeeklyFieldErrors({});
      setIsSavingWeeklyEdit(false);
      setIsCreatingWeekly(false);
      setPendingWeeklyAction(null);
      setIsCreatingManual(false);
      setPendingManualId(null);
      setIsCreatingException(false);
      setPendingExceptionId(null);
    };
  }, []);

  async function handleCreateWeekly(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWeeklyBanner(null);

    const parsed = parseCreateWeeklyScheduleInput({
      dayOfWeek: Number(weeklyDay),
      startTime: weeklyStartTime,
      endTime: weeklyEndTime,
      isActive: true,
    });

    if (!parsed.success) {
      setWeeklyFieldErrors(parsed.fieldErrors);
      setWeeklyBanner({ type: "error", message: parsed.message });
      return;
    }

    setWeeklyFieldErrors({});
    setIsCreatingWeekly(true);

    try {
      const response = await fetch(
        `/api/owner/doctors/${doctor.id}/weekly-schedule`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );

      if (!response.ok) {
        const errorData = await parseJsonSafe<OwnerErrorResponse>(response);
        if (errorData?.fieldErrors) {
          setWeeklyFieldErrors(errorData.fieldErrors);
        }
        setWeeklyBanner({
          type: "error",
          message: errorData?.error ?? DEFAULT_CONNECTION_ERROR,
        });
        return;
      }

      const data = await parseJsonSafe<{ schedule: OwnerWeeklySchedule }>(
        response,
      );
      if (!data?.schedule) {
        setWeeklyBanner({
          type: "error",
          message: DEFAULT_CONNECTION_ERROR,
        });
        return;
      }

      setWeeklySchedules((current) =>
        sortWeeklySchedules([...current, data.schedule]),
      );
      setWeeklyBanner({
        type: "success",
        message: "تم إضافة الفترة للجدول الأسبوعي بنجاح.",
      });
      router.refresh();
    } catch {
      setWeeklyBanner({ type: "error", message: DEFAULT_CONNECTION_ERROR });
    } finally {
      setIsCreatingWeekly(false);
    }
  }

  function startEditWeekly(item: OwnerWeeklySchedule) {
    setWeeklyBanner(null);
    setEditingWeeklyId(item.id);
    setEditWeeklyDay(String(item.dayOfWeek));
    setEditWeeklyStartTime(item.startTime.slice(0, 5));
    setEditWeeklyEndTime(item.endTime.slice(0, 5));
    setEditWeeklyFieldErrors({});
  }

  function cancelEditWeekly() {
    if (isSavingWeeklyEdit) {
      return;
    }
    setEditingWeeklyId(null);
    setEditWeeklyFieldErrors({});
  }

  async function handleSaveWeeklyEdit(
    event: FormEvent<HTMLFormElement>,
    item: OwnerWeeklySchedule,
  ) {
    event.preventDefault();
    if (isSavingWeeklyEdit || pendingWeeklyAction || isCreatingWeekly) {
      return;
    }

    setWeeklyBanner(null);
    const parsed = parseUpdateWeeklyScheduleInput({
      dayOfWeek: Number(editWeeklyDay),
      startTime: editWeeklyStartTime,
      endTime: editWeeklyEndTime,
    });

    if (!parsed.success) {
      setEditWeeklyFieldErrors(parsed.fieldErrors);
      setWeeklyBanner({ type: "error", message: parsed.message });
      return;
    }

    setEditWeeklyFieldErrors({});
    setIsSavingWeeklyEdit(true);

    try {
      const response = await fetch(
        `/api/owner/doctors/${doctor.id}/weekly-schedule/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );

      if (!response.ok) {
        const errorData = await parseJsonSafe<OwnerErrorResponse>(response);
        if (errorData?.fieldErrors) {
          setEditWeeklyFieldErrors(errorData.fieldErrors);
        }
        setWeeklyBanner({
          type: "error",
          message: errorData?.error ?? DEFAULT_CONNECTION_ERROR,
        });
        return;
      }

      const data = await parseJsonSafe<{ schedule: OwnerWeeklySchedule }>(
        response,
      );
      if (!data?.schedule) {
        setWeeklyBanner({
          type: "error",
          message: DEFAULT_CONNECTION_ERROR,
        });
        return;
      }

      setWeeklySchedules((current) =>
        sortWeeklySchedules(
          current.map((entry) =>
            entry.id === item.id ? data.schedule : entry,
          ),
        ),
      );
      setEditingWeeklyId(null);
      setWeeklyBanner({
        type: "success",
        message: "تم تعديل الفترة في الجدول الأسبوعي بنجاح.",
      });
      router.refresh();
    } catch {
      setWeeklyBanner({ type: "error", message: DEFAULT_CONNECTION_ERROR });
    } finally {
      setIsSavingWeeklyEdit(false);
    }
  }

  async function handleToggleWeekly(item: OwnerWeeklySchedule) {
    if (pendingWeeklyAction || isCreatingWeekly || isSavingWeeklyEdit) {
      return;
    }

    setWeeklyBanner(null);
    setPendingWeeklyAction({ id: item.id, action: "toggle" });

    try {
      const response = await fetch(
        `/api/owner/doctors/${doctor.id}/weekly-schedule/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !item.isActive }),
        },
      );

      if (!response.ok) {
        const errorData = await parseJsonSafe<OwnerErrorResponse>(response);
        setWeeklyBanner({
          type: "error",
          message: errorData?.error ?? DEFAULT_CONNECTION_ERROR,
        });
        return;
      }

      const data = await parseJsonSafe<{ schedule: OwnerWeeklySchedule }>(
        response,
      );
      if (!data?.schedule) {
        setWeeklyBanner({
          type: "error",
          message: DEFAULT_CONNECTION_ERROR,
        });
        return;
      }

      setWeeklySchedules((current) =>
        sortWeeklySchedules(
          current.map((entry) =>
            entry.id === item.id ? data.schedule : entry,
          ),
        ),
      );
      setWeeklyBanner({
        type: "success",
        message: data.schedule.isActive
          ? "تم تفعيل الفترة في الجدول الأسبوعي."
          : "تم تعطيل الفترة في الجدول الأسبوعي.",
      });
      router.refresh();
    } catch {
      setWeeklyBanner({ type: "error", message: DEFAULT_CONNECTION_ERROR });
    } finally {
      setPendingWeeklyAction(null);
    }
  }

  async function handleDeleteWeekly(scheduleId: string) {
    if (pendingWeeklyAction || isCreatingWeekly || isSavingWeeklyEdit) {
      return;
    }

    setWeeklyBanner(null);
    setPendingWeeklyAction({ id: scheduleId, action: "delete" });

    try {
      const response = await fetch(
        `/api/owner/doctors/${doctor.id}/weekly-schedule/${scheduleId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorData = await parseJsonSafe<OwnerErrorResponse>(response);
        setWeeklyBanner({
          type: "error",
          message: errorData?.error ?? DEFAULT_CONNECTION_ERROR,
        });
        return;
      }

      setWeeklySchedules((current) =>
        current.filter((entry) => entry.id !== scheduleId),
      );
      if (editingWeeklyId === scheduleId) {
        setEditingWeeklyId(null);
        setEditWeeklyFieldErrors({});
      }
      setWeeklyBanner({
        type: "success",
        message: "تم حذف الفترة من الجدول الأسبوعي.",
      });
      router.refresh();
    } catch {
      setWeeklyBanner({ type: "error", message: DEFAULT_CONNECTION_ERROR });
    } finally {
      setPendingWeeklyAction(null);
    }
  }

  async function handleCreateManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setManualBanner(null);

    const parsed = parseCreateManualAvailabilityInput({
      availabilityDate: manualDate,
      startTime: manualStartTime,
      endTime: manualEndTime,
    });

    if (!parsed.success) {
      setManualFieldErrors(parsed.fieldErrors);
      setManualBanner({ type: "error", message: parsed.message });
      return;
    }

    setManualFieldErrors({});
    setIsCreatingManual(true);

    try {
      const response = await fetch(
        `/api/owner/doctors/${doctor.id}/manual-availability`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );

      if (!response.ok) {
        const errorData = await parseJsonSafe<OwnerErrorResponse>(response);
        if (errorData?.fieldErrors) {
          setManualFieldErrors(errorData.fieldErrors);
        }
        setManualBanner({
          type: "error",
          message: errorData?.error ?? DEFAULT_CONNECTION_ERROR,
        });
        return;
      }

      const data = await parseJsonSafe<{
        availability: OwnerManualAvailability;
      }>(response);
      if (!data?.availability) {
        setManualBanner({
          type: "error",
          message: DEFAULT_CONNECTION_ERROR,
        });
        return;
      }

      setManualAvailabilities((current) =>
        sortManualAvailabilities([...current, data.availability]),
      );
      setManualDate("");
      setManualBanner({
        type: "success",
        message: "تم إضافة الميعاد الإضافي بنجاح.",
      });
      router.refresh();
    } catch {
      setManualBanner({ type: "error", message: DEFAULT_CONNECTION_ERROR });
    } finally {
      setIsCreatingManual(false);
    }
  }

  async function handleDeleteManual(availabilityId: string) {
    if (pendingManualId || isCreatingManual) {
      return;
    }

    setManualBanner(null);
    setPendingManualId(availabilityId);

    try {
      const response = await fetch(
        `/api/owner/doctors/${doctor.id}/manual-availability/${availabilityId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorData = await parseJsonSafe<OwnerErrorResponse>(response);
        setManualBanner({
          type: "error",
          message: errorData?.error ?? DEFAULT_CONNECTION_ERROR,
        });
        return;
      }

      setManualAvailabilities((current) =>
        current.filter((entry) => entry.id !== availabilityId),
      );
      setManualBanner({
        type: "success",
        message: "تم حذف الميعاد الإضافي.",
      });
      router.refresh();
    } catch {
      setManualBanner({ type: "error", message: DEFAULT_CONNECTION_ERROR });
    } finally {
      setPendingManualId(null);
    }
  }

  function handleExceptionTypeChange(nextType: ScheduleExceptionType) {
    setExceptionType(nextType);
    setExceptionFieldErrors((current) => {
      const next = { ...current };
      delete next.exceptionType;
      if (nextType === "CLOSED") {
        delete next.startTime;
        delete next.endTime;
      }
      return next;
    });
  }

  async function handleCreateException(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExceptionBanner(null);

    const parsed = parseCreateScheduleExceptionInput({
      exceptionDate,
      exceptionType,
      startTime: exceptionType === "CLOSED" ? null : exceptionStartTime,
      endTime: exceptionType === "CLOSED" ? null : exceptionEndTime,
      reason: exceptionReason.trim() ? exceptionReason.trim() : null,
    });

    if (!parsed.success) {
      setExceptionFieldErrors(parsed.fieldErrors);
      setExceptionBanner({ type: "error", message: parsed.message });
      return;
    }

    setExceptionFieldErrors({});
    setIsCreatingException(true);

    try {
      const response = await fetch(
        `/api/owner/doctors/${doctor.id}/schedule-exceptions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );

      if (!response.ok) {
        const errorData = await parseJsonSafe<OwnerErrorResponse>(response);
        if (errorData?.fieldErrors) {
          setExceptionFieldErrors(errorData.fieldErrors);
        }
        setExceptionBanner({
          type: "error",
          message: errorData?.error ?? DEFAULT_CONNECTION_ERROR,
        });
        return;
      }

      const data = await parseJsonSafe<{ exception: OwnerScheduleException }>(
        response,
      );
      if (!data?.exception) {
        setExceptionBanner({
          type: "error",
          message: DEFAULT_CONNECTION_ERROR,
        });
        return;
      }

      setScheduleExceptions((current) =>
        sortScheduleExceptions([...current, data.exception]),
      );
      setExceptionDate("");
      setExceptionReason("");
      setExceptionBanner({
        type: "success",
        message: "تم حفظ استثناء الجدول بنجاح.",
      });
      router.refresh();
    } catch {
      setExceptionBanner({ type: "error", message: DEFAULT_CONNECTION_ERROR });
    } finally {
      setIsCreatingException(false);
    }
  }

  async function handleDeleteException(exceptionId: string) {
    if (pendingExceptionId || isCreatingException) {
      return;
    }

    setExceptionBanner(null);
    setPendingExceptionId(exceptionId);

    try {
      const response = await fetch(
        `/api/owner/doctors/${doctor.id}/schedule-exceptions/${exceptionId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorData = await parseJsonSafe<OwnerErrorResponse>(response);
        setExceptionBanner({
          type: "error",
          message: errorData?.error ?? DEFAULT_CONNECTION_ERROR,
        });
        return;
      }

      setScheduleExceptions((current) =>
        current.filter((entry) => entry.id !== exceptionId),
      );
      setExceptionBanner({
        type: "success",
        message: "تم حذف الاستثناء.",
      });
      router.refresh();
    } catch {
      setExceptionBanner({ type: "error", message: DEFAULT_CONNECTION_ERROR });
    } finally {
      setPendingExceptionId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <Link
          href="/owner/doctors"
          className="inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline"
        >
          ← الرجوع للدكاترة
        </Link>

        <PageHeader
          className="mt-2"
          title={`مواعيد ${doctor.fullName}`}
          description="نظّم مواعيد الكشف الثابتة، المواعيد الإضافية، وأيام الإجازات والاستثناءات للدكتور ده."
          action={<ActiveStatusBadge isActive={doctor.isActive} />}
        />

        <dl className="mt-5 grid gap-4 rounded-md border border-border bg-card p-4 sm:grid-cols-3 sm:p-5">
          <div>
            <dt className="text-xs font-bold text-muted-foreground">العيادة</dt>
            <dd className="mt-1 text-base font-extrabold text-foreground">
              {doctor.clinicName}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-muted-foreground">التخصص</dt>
            <dd className="mt-1 text-base font-extrabold text-foreground">
              {doctor.specialtyName}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-muted-foreground">
              مدة الكشف
            </dt>
            <dd className="mt-1 text-base font-extrabold text-foreground">
              {doctor.slotDurationMinutes} دقيقة
            </dd>
          </div>
        </dl>

        {!doctor.isActive ? (
          <p
            role="status"
            className="mt-4 rounded-md border border-border bg-card px-4 py-3 text-sm leading-6 font-semibold text-muted-foreground"
          >
            الدكتور ده غير نشط حالياً. تقدر تجهّز جدوله هنا، لكن مش هيظهر
            للمرضى للحجز غير لما تفعّله من صفحة الدكاترة.
          </p>
        ) : null}
      </div>

      {/* 1. Weekly schedule */}
      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle>الجدول الأسبوعي الثابت</CardTitle>
          <CardDescription>
            الأيام وساعات العمل الأساسية اللي بتتكرر كل أسبوع للدكتور.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          <SectionAlert banner={weeklyBanner} />

          <form onSubmit={handleCreateWeekly} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="اليوم"
                htmlFor="weekly-day"
                required
                error={weeklyFieldErrors.dayOfWeek}
              >
                <Select
                  id="weekly-day"
                  value={weeklyDay}
                  disabled={isCreatingWeekly}
                  aria-invalid={Boolean(weeklyFieldErrors.dayOfWeek)}
                  onChange={(event) => {
                    setWeeklyDay(event.target.value);
                    setWeeklyFieldErrors((current) => {
                      const next = { ...current };
                      delete next.dayOfWeek;
                      return next;
                    });
                  }}
                >
                  {WEEKDAY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="من الساعة"
                htmlFor="weekly-start"
                required
                error={weeklyFieldErrors.startTime}
              >
                <Input
                  id="weekly-start"
                  type="time"
                  dir="ltr"
                  className="text-left"
                  value={weeklyStartTime}
                  disabled={isCreatingWeekly}
                  aria-invalid={Boolean(weeklyFieldErrors.startTime)}
                  onChange={(event) => {
                    setWeeklyStartTime(event.target.value);
                    setWeeklyFieldErrors((current) => {
                      const next = { ...current };
                      delete next.startTime;
                      delete next.endTime;
                      return next;
                    });
                  }}
                />
              </Field>

              <Field
                label="لحد الساعة"
                htmlFor="weekly-end"
                required
                error={weeklyFieldErrors.endTime}
              >
                <Input
                  id="weekly-end"
                  type="time"
                  dir="ltr"
                  className="text-left"
                  value={weeklyEndTime}
                  disabled={isCreatingWeekly}
                  aria-invalid={Boolean(weeklyFieldErrors.endTime)}
                  onChange={(event) => {
                    setWeeklyEndTime(event.target.value);
                    setWeeklyFieldErrors((current) => {
                      const next = { ...current };
                      delete next.endTime;
                      return next;
                    });
                  }}
                />
              </Field>
            </div>

            <Button
              type="submit"
              disabled={
                isCreatingWeekly ||
                pendingWeeklyAction !== null ||
                isSavingWeeklyEdit
              }
            >
              {isCreatingWeekly ? (
                <>
                  <Loader2
                    className="size-5 animate-spin"
                    aria-hidden="true"
                  />
                  بنضيف الفترة...
                </>
              ) : (
                <>
                  <Plus className="size-5" aria-hidden="true" />
                  إضافة للجدول الأسبوعي
                </>
              )}
            </Button>
          </form>

          <div
            className="my-6 border-t border-dashed border-foreground/20"
            aria-hidden="true"
          />

          {weeklySchedules.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-background/60 px-4 py-8 text-center">
              <p className="text-base font-extrabold text-foreground">
                مفيش فترات في الجدول الأسبوعي لسه
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                ضيف أيام وساعات العمل من النموذج فوق عشان تظهر المواعيد للمرضى.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border bg-background/40">
              {weeklySchedules.map((item) => {
                const isTogglingThis =
                  pendingWeeklyAction?.id === item.id &&
                  pendingWeeklyAction.action === "toggle";
                const isDeletingThis =
                  pendingWeeklyAction?.id === item.id &&
                  pendingWeeklyAction.action === "delete";
                const isAnyWeeklyBusy =
                  pendingWeeklyAction !== null ||
                  isCreatingWeekly ||
                  isSavingWeeklyEdit;
                const isEditingThis = editingWeeklyId === item.id;
                const weeklySummary = `${getWeekdayLabel(item.dayOfWeek)} (${formatArabicTime(item.startTime)} - ${formatArabicTime(item.endTime)})`;

                if (isEditingThis) {
                  return (
                    <li key={item.id} className="bg-card px-4 py-4">
                      <form
                        onSubmit={(event) => handleSaveWeeklyEdit(event, item)}
                        noValidate
                        className="space-y-4"
                      >
                        <div className="grid gap-4 sm:grid-cols-3">
                          <Field
                            label="اليوم"
                            htmlFor={`edit-weekly-day-${item.id}`}
                            required
                            error={editWeeklyFieldErrors.dayOfWeek}
                          >
                            <Select
                              id={`edit-weekly-day-${item.id}`}
                              value={editWeeklyDay}
                              disabled={isSavingWeeklyEdit}
                              aria-invalid={Boolean(
                                editWeeklyFieldErrors.dayOfWeek,
                              )}
                              onChange={(event) => {
                                setEditWeeklyDay(event.target.value);
                                setEditWeeklyFieldErrors((current) => {
                                  const next = { ...current };
                                  delete next.dayOfWeek;
                                  return next;
                                });
                              }}
                            >
                              {WEEKDAY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                          </Field>

                          <Field
                            label="من الساعة"
                            htmlFor={`edit-weekly-start-${item.id}`}
                            required
                            error={editWeeklyFieldErrors.startTime}
                          >
                            <Input
                              id={`edit-weekly-start-${item.id}`}
                              type="time"
                              dir="ltr"
                              className="text-left"
                              value={editWeeklyStartTime}
                              disabled={isSavingWeeklyEdit}
                              aria-invalid={Boolean(
                                editWeeklyFieldErrors.startTime,
                              )}
                              onChange={(event) => {
                                setEditWeeklyStartTime(event.target.value);
                                setEditWeeklyFieldErrors((current) => {
                                  const next = { ...current };
                                  delete next.startTime;
                                  delete next.endTime;
                                  return next;
                                });
                              }}
                            />
                          </Field>

                          <Field
                            label="لحد الساعة"
                            htmlFor={`edit-weekly-end-${item.id}`}
                            required
                            error={editWeeklyFieldErrors.endTime}
                          >
                            <Input
                              id={`edit-weekly-end-${item.id}`}
                              type="time"
                              dir="ltr"
                              className="text-left"
                              value={editWeeklyEndTime}
                              disabled={isSavingWeeklyEdit}
                              aria-invalid={Boolean(
                                editWeeklyFieldErrors.endTime,
                              )}
                              onChange={(event) => {
                                setEditWeeklyEndTime(event.target.value);
                                setEditWeeklyFieldErrors((current) => {
                                  const next = { ...current };
                                  delete next.endTime;
                                  return next;
                                });
                              }}
                            />
                          </Field>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="submit" disabled={isSavingWeeklyEdit}>
                            {isSavingWeeklyEdit ? (
                              <>
                                <Loader2
                                  className="size-4 animate-spin"
                                  aria-hidden="true"
                                />
                                بنحفظ التعديل...
                              </>
                            ) : (
                              "حفظ التعديل"
                            )}
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            disabled={isSavingWeeklyEdit}
                            onClick={cancelEditWeekly}
                          >
                            إلغاء
                          </Button>
                        </div>
                      </form>
                    </li>
                  );
                }

                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-base font-extrabold text-foreground">
                          {getWeekdayLabel(item.dayOfWeek)}
                        </span>
                        <ActiveStatusBadge isActive={item.isActive} />
                      </div>
                      <p className="text-sm font-semibold text-muted-foreground">
                        {formatArabicTime(item.startTime)} -{" "}
                        {formatArabicTime(item.endTime)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isAnyWeeklyBusy}
                        aria-label={`تعديل فترة ${weeklySummary}`}
                        onClick={() => startEditWeekly(item)}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                        تعديل
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        disabled={isAnyWeeklyBusy}
                        aria-label={
                          item.isActive
                            ? `تعطيل فترة ${weeklySummary}`
                            : `تفعيل فترة ${weeklySummary}`
                        }
                        onClick={() => handleToggleWeekly(item)}
                      >
                        {isTogglingThis ? (
                          <Loader2
                            className="size-4 animate-spin"
                            aria-hidden="true"
                          />
                        ) : item.isActive ? (
                          <PauseCircle className="size-4" aria-hidden="true" />
                        ) : (
                          <PlayCircle className="size-4" aria-hidden="true" />
                        )}
                        {item.isActive ? "تعطيل" : "تفعيل"}
                      </Button>

                      <Button
                        type="button"
                        variant="destructive"
                        disabled={isAnyWeeklyBusy}
                        aria-label={`حذف فترة ${weeklySummary}`}
                        onClick={() => handleDeleteWeekly(item.id)}
                      >
                        {isDeletingThis ? (
                          <Loader2
                            className="size-4 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Trash2 className="size-4" aria-hidden="true" />
                        )}
                        حذف
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 2. Manual availability */}
      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle>مواعيد إضافية بتاريخ محدد</CardTitle>
          <CardDescription>
            المواعيد دي بتضيف ساعات شغل إضافية في تاريخ معين فوق الجدول
            الأسبوعي العادي.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          <SectionAlert banner={manualBanner} />

          <form onSubmit={handleCreateManual} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="التاريخ"
                htmlFor="manual-date"
                required
                error={manualFieldErrors.availabilityDate}
              >
                <Input
                  id="manual-date"
                  type="date"
                  dir="ltr"
                  className="text-left"
                  value={manualDate}
                  disabled={isCreatingManual}
                  aria-invalid={Boolean(manualFieldErrors.availabilityDate)}
                  onChange={(event) => {
                    setManualDate(event.target.value);
                    setManualFieldErrors((current) => {
                      const next = { ...current };
                      delete next.availabilityDate;
                      return next;
                    });
                  }}
                />
              </Field>

              <Field
                label="من الساعة"
                htmlFor="manual-start"
                required
                error={manualFieldErrors.startTime}
              >
                <Input
                  id="manual-start"
                  type="time"
                  dir="ltr"
                  className="text-left"
                  value={manualStartTime}
                  disabled={isCreatingManual}
                  aria-invalid={Boolean(manualFieldErrors.startTime)}
                  onChange={(event) => {
                    setManualStartTime(event.target.value);
                    setManualFieldErrors((current) => {
                      const next = { ...current };
                      delete next.startTime;
                      delete next.endTime;
                      return next;
                    });
                  }}
                />
              </Field>

              <Field
                label="لحد الساعة"
                htmlFor="manual-end"
                required
                error={manualFieldErrors.endTime}
              >
                <Input
                  id="manual-end"
                  type="time"
                  dir="ltr"
                  className="text-left"
                  value={manualEndTime}
                  disabled={isCreatingManual}
                  aria-invalid={Boolean(manualFieldErrors.endTime)}
                  onChange={(event) => {
                    setManualEndTime(event.target.value);
                    setManualFieldErrors((current) => {
                      const next = { ...current };
                      delete next.endTime;
                      return next;
                    });
                  }}
                />
              </Field>
            </div>

            <Button
              type="submit"
              disabled={isCreatingManual || pendingManualId !== null}
            >
              {isCreatingManual ? (
                <>
                  <Loader2
                    className="size-5 animate-spin"
                    aria-hidden="true"
                  />
                  بنضيف الميعاد...
                </>
              ) : (
                <>
                  <CalendarPlus className="size-5" aria-hidden="true" />
                  إضافة ميعاد إضافي
                </>
              )}
            </Button>
          </form>

          <div
            className="my-6 border-t border-dashed border-foreground/20"
            aria-hidden="true"
          />

          {manualAvailabilities.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-background/60 px-4 py-8 text-center">
              <p className="text-base font-extrabold text-foreground">
                مفيش مواعيد إضافية مسجلة
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                لو الدكتور هيشتغل فترة زيادة في يوم محدد، ضيفها من هنا.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border bg-background/40">
              {manualAvailabilities.map((item) => {
                const isBusy = pendingManualId === item.id;
                const manualSummary = `${formatArabicDate(item.availabilityDate)} (${formatArabicTime(item.startTime)} - ${formatArabicTime(item.endTime)})`;
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <p className="text-base font-extrabold text-foreground">
                        {formatArabicDate(item.availabilityDate)}
                      </p>
                      <p className="text-sm font-semibold text-muted-foreground">
                        {formatArabicTime(item.startTime)} -{" "}
                        {formatArabicTime(item.endTime)}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="destructive"
                      disabled={pendingManualId !== null || isCreatingManual}
                      aria-label={`حذف الميعاد الإضافي ${manualSummary}`}
                      onClick={() => handleDeleteManual(item.id)}
                    >
                      {isBusy ? (
                        <Loader2
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Trash2 className="size-4" aria-hidden="true" />
                      )}
                      حذف
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 3. Schedule exceptions */}
      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle>استثناءات الجدول والإجازات</CardTitle>
          <CardDescription>
            استثناءات الجدول بتلغي أو تعدّل ساعات الجدول الأسبوعي في التاريخ ده
            بس (مثلاً إجازة أو تغيير مواعيد اليوم).
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          <SectionAlert banner={exceptionBanner} />

          <form
            onSubmit={handleCreateException}
            noValidate
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="تاريخ الاستثناء"
                htmlFor="exception-date"
                required
                error={exceptionFieldErrors.exceptionDate}
              >
                <Input
                  id="exception-date"
                  type="date"
                  dir="ltr"
                  className="text-left"
                  value={exceptionDate}
                  disabled={isCreatingException}
                  aria-invalid={Boolean(exceptionFieldErrors.exceptionDate)}
                  onChange={(event) => {
                    setExceptionDate(event.target.value);
                    setExceptionFieldErrors((current) => {
                      const next = { ...current };
                      delete next.exceptionDate;
                      return next;
                    });
                  }}
                />
              </Field>

              <Field
                label="نوع الاستثناء"
                htmlFor="exception-type"
                required
                error={exceptionFieldErrors.exceptionType}
              >
                <Select
                  id="exception-type"
                  value={exceptionType}
                  disabled={isCreatingException}
                  aria-invalid={Boolean(exceptionFieldErrors.exceptionType)}
                  onChange={(event) =>
                    handleExceptionTypeChange(
                      event.target.value as ScheduleExceptionType,
                    )
                  }
                >
                  {EXCEPTION_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {exceptionType === "CLOSED" ? (
              <p className="rounded-md border border-border bg-background/60 px-4 py-3 text-sm leading-6 font-semibold text-muted-foreground">
                في يوم الإجازة، اليوم كله بيكون مقفول عن الجدول الأسبوعي ومش
                محتاج تحدد ساعات عمل.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="من الساعة"
                  htmlFor="exception-start"
                  required
                  error={exceptionFieldErrors.startTime}
                >
                  <Input
                    id="exception-start"
                    type="time"
                    dir="ltr"
                    className="text-left"
                    value={exceptionStartTime}
                    disabled={isCreatingException}
                    aria-invalid={Boolean(exceptionFieldErrors.startTime)}
                    onChange={(event) => {
                      setExceptionStartTime(event.target.value);
                      setExceptionFieldErrors((current) => {
                        const next = { ...current };
                        delete next.startTime;
                        delete next.endTime;
                        return next;
                      });
                    }}
                  />
                </Field>

                <Field
                  label="لحد الساعة"
                  htmlFor="exception-end"
                  required
                  error={exceptionFieldErrors.endTime}
                >
                  <Input
                    id="exception-end"
                    type="time"
                    dir="ltr"
                    className="text-left"
                    value={exceptionEndTime}
                    disabled={isCreatingException}
                    aria-invalid={Boolean(exceptionFieldErrors.endTime)}
                    onChange={(event) => {
                      setExceptionEndTime(event.target.value);
                      setExceptionFieldErrors((current) => {
                        const next = { ...current };
                        delete next.endTime;
                        return next;
                      });
                    }}
                  />
                </Field>
              </div>
            )}

            <Field
              label="السبب (اختياري)"
              htmlFor="exception-reason"
              error={exceptionFieldErrors.reason}
              hint="ممكن تكتب سبب مختصر زي إجازة رسمية أو مؤتمر طبي."
            >
              <Input
                id="exception-reason"
                type="text"
                maxLength={300}
                placeholder="مثلاً: إجازة عيد أو تغيير معاد العيادة"
                value={exceptionReason}
                disabled={isCreatingException}
                aria-invalid={Boolean(exceptionFieldErrors.reason)}
                onChange={(event) => {
                  setExceptionReason(event.target.value);
                  setExceptionFieldErrors((current) => {
                    const next = { ...current };
                    delete next.reason;
                    return next;
                  });
                }}
              />
            </Field>

            <Button
              type="submit"
              disabled={isCreatingException || pendingExceptionId !== null}
            >
              {isCreatingException ? (
                <>
                  <Loader2
                    className="size-5 animate-spin"
                    aria-hidden="true"
                  />
                  بنحفظ الاستثناء...
                </>
              ) : (
                <>
                  <Plus className="size-5" aria-hidden="true" />
                  إضافة استثناء
                </>
              )}
            </Button>
          </form>

          <div
            className="my-6 border-t border-dashed border-foreground/20"
            aria-hidden="true"
          />

          {scheduleExceptions.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-background/60 px-4 py-8 text-center">
              <p className="text-base font-extrabold text-foreground">
                مفيش استثناءات أو إجازات مسجلة
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                لو فيه يوم إجازة أو ساعات عمل مختلفة عن الجدول الأسبوعي، سجله
                من هنا.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border bg-background/40">
              {scheduleExceptions.map((item) => {
                const isBusy = pendingExceptionId === item.id;
                const exceptionSummary = formatArabicDate(item.exceptionDate);
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-base font-extrabold text-foreground">
                          {exceptionSummary}
                        </span>
                        <ExceptionTypeBadge
                          exceptionType={item.exceptionType}
                        />
                      </div>

                      {item.startTime && item.endTime ? (
                        <p className="text-sm font-semibold text-muted-foreground">
                          {formatArabicTime(item.startTime)} -{" "}
                          {formatArabicTime(item.endTime)}
                        </p>
                      ) : null}

                      {item.reason ? (
                        <p className="text-sm leading-6 text-muted-foreground">
                          السبب: {item.reason}
                        </p>
                      ) : null}
                    </div>

                    <Button
                      type="button"
                      variant="destructive"
                      disabled={
                        pendingExceptionId !== null || isCreatingException
                      }
                      aria-label={`حذف استثناء ${exceptionSummary}`}
                      onClick={() => handleDeleteException(item.id)}
                    >
                      {isBusy ? (
                        <Loader2
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Trash2 className="size-4" aria-hidden="true" />
                      )}
                      حذف
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
