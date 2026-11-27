import {
  Building2,
  CalendarCheck2,
  CalendarClock,
  HeartPulse,
  Stethoscope,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/state";
import { BookingStatusBadge } from "@/components/ui/status-badge";
import { formatArabicDate } from "@/lib/format";
import { formatArabicTime } from "@/lib/schedule";
import type { OwnerAppointment, OwnerDashboardOverview } from "@/types/owner";

type SummaryMetricItem = {
  id: string;
  label: string;
  value: number;
  subtitle: string;
  href: string;
  linkLabel: string;
  icon: LucideIcon;
};

export function OwnerAppointmentSlip({
  appointment,
}: {
  appointment: OwnerAppointment;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-border pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <BookingStatusBadge status={appointment.status} />
          {!appointment.doctorIsActive ? (
            <Badge variant="outline">دكتور غير نشط</Badge>
          ) : null}
          {!appointment.clinicIsActive ? (
            <Badge variant="outline">عيادة غير نشطة</Badge>
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
            <dt className="font-bold text-muted-foreground">العيادة</dt>
            <dd className="mt-0.5 font-semibold text-foreground">
              {appointment.clinicName}
            </dd>
          </div>

          <div>
            <dt className="font-bold text-muted-foreground">التاريخ</dt>
            <dd className="mt-0.5 font-semibold text-foreground">
              {formatArabicDate(appointment.appointmentDate)}
            </dd>
          </div>

          <div>
            <dt className="font-bold text-muted-foreground">الوقت</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-foreground">
              {formatArabicTime(appointment.startTime)} -{" "}
              {formatArabicTime(appointment.endTime)}
            </dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}

export function OwnerOverview({
  overview,
}: {
  overview: OwnerDashboardOverview;
}) {
  const { counts } = overview;

  const summaryMetrics: SummaryMetricItem[] = [
    {
      id: "clinics",
      label: "العيادات",
      value: counts.clinicsActive,
      subtitle: `نشطة من إجمالي ${counts.clinicsTotal}`,
      href: "/owner/clinics",
      linkLabel: "إدارة العيادات",
      icon: Building2,
    },
    {
      id: "specialties",
      label: "التخصصات",
      value: counts.specialtiesActive,
      subtitle: `نشط من إجمالي ${counts.specialtiesTotal}`,
      href: "/owner/specialties",
      linkLabel: "إدارة التخصصات",
      icon: HeartPulse,
    },
    {
      id: "doctors",
      label: "الدكاترة",
      value: counts.doctorsActive,
      subtitle: `نشط من إجمالي ${counts.doctorsTotal}`,
      href: "/owner/doctors",
      linkLabel: "إدارة الدكاترة",
      icon: Stethoscope,
    },
    {
      id: "receptionists",
      label: "موظفي الاستقبال",
      value: counts.receptionistsActive,
      subtitle: `نشط من إجمالي ${counts.receptionistsTotal}`,
      href: "/owner/receptionists",
      linkLabel: "موظفي الاستقبال",
      icon: UserCog,
    },
    {
      id: "today",
      label: "حجوزات النهارده",
      value: counts.todayAppointments,
      subtitle: "حجز غير ملغي النهارده",
      href: "/owner/appointments",
      linkLabel: "كل الحجوزات",
      icon: CalendarCheck2,
    },
    {
      id: "upcoming",
      label: "الحجوزات الجاية",
      value: counts.upcomingAppointments,
      subtitle: "حجز مؤكد أو واصل للأيام الجاية",
      href: "/owner/appointments",
      linkLabel: "كل الحجوزات",
      icon: CalendarClock,
    },
  ];

  return (
    <div>
      <PageHeader
        title="نظرة عامة"
        description={`ملخص العيادات والدكاترة والحجوزات ليوم ${formatArabicDate(overview.todayDate)}.`}
        action={
          <Link
            href="/owner/appointments"
            className={buttonVariants({ variant: "default", size: "default" })}
          >
            كل الحجوزات
          </Link>
        }
      />

      <section aria-labelledby="owner-summary-heading" className="mt-8">
        <h2 id="owner-summary-heading" className="sr-only">
          ملخص المنصة
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaryMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.id} className="flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-heading text-base font-extrabold text-foreground">
                      {metric.label}
                    </h3>
                    <Icon
                      className="size-5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-3 font-heading text-3xl font-extrabold tabular-nums text-foreground">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {metric.subtitle}
                  </p>
                </div>

                <div className="mt-4 border-t border-dashed border-border pt-3">
                  <Link
                    href={metric.href}
                    className="inline-flex min-h-11 items-center text-sm font-bold text-primary underline-offset-4 hover:underline"
                  >
                    {metric.linkLabel}
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="owner-today-heading" className="mt-10 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="owner-today-heading"
              className="font-heading text-xl font-extrabold text-foreground sm:text-2xl"
            >
              حجوزات النهارده
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {formatArabicDate(overview.todayDate)}
              {counts.todayAppointments > overview.todayAppointments.length
                ? ` — معروض أول ${overview.todayAppointments.length} من إجمالي ${counts.todayAppointments} حجز`
                : ` — إجمالي ${counts.todayAppointments} حجز`}
            </p>
          </div>
          <Link
            href="/owner/appointments"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            عرض كل الحجوزات
          </Link>
        </div>

        {overview.todayAppointments.length === 0 ? (
          <EmptyState
            title="مفيش حجوزات النهارده"
            description="لما المرضى يحجزوا مواعيد ليوم النهارده هتظهر هنا على طول."
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {overview.todayAppointments.map((appointment) => (
              <li key={appointment.id}>
                <OwnerAppointmentSlip appointment={appointment} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="owner-upcoming-heading"
        className="mt-10 space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="owner-upcoming-heading"
              className="font-heading text-xl font-extrabold text-foreground sm:text-2xl"
            >
              الحجوزات الجاية
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              الحجوزات المؤكدة والواصلة للأيام اللي جاية
              {counts.upcomingAppointments > overview.upcomingAppointments.length
                ? ` — معروض أول ${overview.upcomingAppointments.length} من إجمالي ${counts.upcomingAppointments} حجز`
                : ` — إجمالي ${counts.upcomingAppointments} حجز`}
            </p>
          </div>
          <Link
            href="/owner/appointments"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            عرض كل الحجوزات
          </Link>
        </div>

        {overview.upcomingAppointments.length === 0 ? (
          <EmptyState
            title="مفيش حجوزات جاية دلوقتي"
            description="الحجوزات المؤكدة للأيام اللي بعد النهارده هتظهر هنا أول بأول."
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {overview.upcomingAppointments.map((appointment) => (
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
