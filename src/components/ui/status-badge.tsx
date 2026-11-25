import {
  Ban,
  CalendarCheck2,
  CalendarDays,
  CalendarX2,
  CheckCheck,
  UserCheck,
  UserX,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { AppointmentStatus } from "@/types/database";

type StatusMeta = {
  label: string;
  icon: LucideIcon;
  variant: BadgeVariant;
};

const bookingStatuses = {
  CONFIRMED: {
    label: "مؤكد",
    icon: CalendarCheck2,
    variant: "default",
  },
  CHECKED_IN: {
    label: "وصل العيادة",
    icon: UserCheck,
    variant: "success",
  },
  COMPLETED: {
    label: "خلص",
    icon: CheckCheck,
    variant: "secondary",
  },
  CANCELLED: {
    label: "ملغي",
    icon: XCircle,
    variant: "destructive",
  },
  NO_SHOW: {
    label: "ما حضرش",
    icon: UserX,
    variant: "outline",
  },
} satisfies Record<AppointmentStatus, StatusMeta>;

export function BookingStatusBadge({ status }: { status: AppointmentStatus }) {
  const meta = bookingStatuses[status];
  const Icon = meta.icon;

  return (
    <Badge variant={meta.variant}>
      <Icon className="size-3.5" aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

export type AvailabilityStatus = "AVAILABLE" | "FULL" | "OFF";

const availabilityStatuses = {
  AVAILABLE: {
    label: "متاح",
    icon: CalendarDays,
    variant: "default",
  },
  FULL: {
    label: "مكتمل",
    icon: Ban,
    variant: "warning",
  },
  OFF: {
    label: "مقفول",
    icon: CalendarX2,
    variant: "outline",
  },
} satisfies Record<AvailabilityStatus, StatusMeta>;

export function AvailabilityStatusBadge({
  status,
}: {
  status: AvailabilityStatus;
}) {
  const meta = availabilityStatuses[status];
  const Icon = meta.icon;

  return (
    <Badge variant={meta.variant}>
      <Icon className="size-3.5" aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}
