"use client";

import {
  AlertCircle,
  CheckCheck,
  Loader2,
  Stamp,
  UserCheck,
  UserX,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookingStatusBadge } from "@/components/ui/status-badge";
import { formatArabicDate } from "@/lib/format";
import { formatArabicTime } from "@/lib/schedule";
import type {
  ReceptionistAppointment,
  ReceptionistStatusTarget,
} from "@/types/receptionist";

export interface ReceptionistAppointmentCardProps {
  appointment: ReceptionistAppointment;
  pendingAction?: ReceptionistStatusTarget | null;
  disableActions?: boolean;
  showCheckInLink?: boolean;
  onCheckIn?: (appointment: ReceptionistAppointment) => void;
  onUpdateStatus?: (
    appointment: ReceptionistAppointment,
    targetStatus: Exclude<ReceptionistStatusTarget, "CHECKED_IN">,
  ) => void;
}

export function ReceptionistAppointmentCard({
  appointment,
  pendingAction = null,
  disableActions = false,
  showCheckInLink = false,
  onCheckIn,
  onUpdateStatus,
}: ReceptionistAppointmentCardProps) {
  const isBusy = pendingAction !== null;
  const isDisabled = isBusy || disableActions;
  const hasActionHandlers = Boolean(onCheckIn || onUpdateStatus);
  const showFooter = hasActionHandlers || showCheckInLink;

  return (
    <Card className="flex flex-col justify-between p-5">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-border pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={appointment.status} />
            {!appointment.doctorIsActive ? (
              <Badge variant="outline">دكتور غير نشط</Badge>
            ) : null}
          </div>
          <span
            dir="ltr"
            className="font-mono text-sm font-extrabold tabular-nums text-foreground"
          >
            {appointment.referenceNumber}
          </span>
        </div>

        <div className="pt-4">
          <h3 className="font-heading text-lg font-extrabold text-foreground">
            {appointment.patientName}
          </h3>

          <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-bold text-muted-foreground">رقم الموبايل</dt>
              <dd
                dir="ltr"
                className="mt-0.5 w-fit font-mono font-bold tabular-nums text-foreground"
              >
                {appointment.patientPhone}
              </dd>
            </div>

            <div>
              <dt className="font-bold text-muted-foreground">الدكتور</dt>
              <dd className="mt-0.5 font-bold text-foreground">
                {appointment.doctorName}
              </dd>
            </div>

            <div>
              <dt className="font-bold text-muted-foreground">التخصص</dt>
              <dd className="mt-0.5 font-semibold text-foreground">
                {appointment.specialtyName}
              </dd>
            </div>

            <div>
              <dt className="font-bold text-muted-foreground">التاريخ</dt>
              <dd className="mt-0.5 font-semibold text-foreground">
                {formatArabicDate(appointment.appointmentDate)}
              </dd>
            </div>

            <div className="sm:col-span-2">
              <dt className="font-bold text-muted-foreground">الوقت</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-foreground">
                {formatArabicTime(appointment.startTime)} -{" "}
                {formatArabicTime(appointment.endTime)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {showFooter ? (
        <div className="mt-4 space-y-3 border-t border-dashed border-border pt-4">
          {appointment.status === "CANCELLED" ? (
            <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs leading-6 font-semibold text-destructive">
              <AlertCircle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>الحجز ده ملغي وما ينفعش تسجّل وصول المريض.</span>
            </p>
          ) : null}

          {appointment.status === "COMPLETED" && hasActionHandlers ? (
            <p className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <Stamp className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>تم الكشف للمريض.</span>
            </p>
          ) : null}

          {appointment.status === "NO_SHOW" && hasActionHandlers ? (
            <p className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <UserX className="size-4 shrink-0" aria-hidden="true" />
              <span>الحجز ده متسجّل إنه ما حضرش.</span>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2.5">
            {appointment.status === "CONFIRMED" && onCheckIn ? (
              <Button
                type="button"
                disabled={isDisabled}
                aria-label={`تسجيل وصول المريض ${appointment.patientName} للحجز ${appointment.referenceNumber}`}
                onClick={() => onCheckIn(appointment)}
              >
                {pendingAction === "CHECKED_IN" ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    بنسجّل الوصول...
                  </>
                ) : (
                  <>
                    <UserCheck className="size-4" aria-hidden="true" />
                    تسجيل وصول المريض
                  </>
                )}
              </Button>
            ) : null}

            {appointment.status === "CONFIRMED" && onUpdateStatus ? (
              <Button
                type="button"
                variant="outline"
                disabled={isDisabled}
                aria-label={`تسجيل عدم حضور ${appointment.patientName} للحجز ${appointment.referenceNumber}`}
                onClick={() => onUpdateStatus(appointment, "NO_SHOW")}
              >
                {pendingAction === "NO_SHOW" ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    بنحدّث الحالة...
                  </>
                ) : (
                  <>
                    <UserX className="size-4" aria-hidden="true" />
                    ما حضرش
                  </>
                )}
              </Button>
            ) : null}

            {appointment.status === "CHECKED_IN" && onUpdateStatus ? (
              <Button
                type="button"
                variant="secondary"
                disabled={isDisabled}
                aria-label={`إنهاء كشف ${appointment.patientName} للحجز ${appointment.referenceNumber}`}
                onClick={() => onUpdateStatus(appointment, "COMPLETED")}
              >
                {pendingAction === "COMPLETED" ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    بنحدّث الحالة...
                  </>
                ) : (
                  <>
                    <CheckCheck className="size-4" aria-hidden="true" />
                    تم الكشف
                  </>
                )}
              </Button>
            ) : null}

            {showCheckInLink ? (
              <Link
                href={`/receptionist/check-in?reference=${encodeURIComponent(appointment.referenceNumber)}`}
                className={buttonVariants({
                  variant: "outline",
                  size: "default",
                })}
              >
                فتح في شاشة الوصول
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
