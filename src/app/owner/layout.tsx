import {
  Building2,
  CalendarDays,
  Stethoscope,
  UserCog,
  Users,
} from "lucide-react";
import * as React from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import {
  DashboardShell,
  type DashboardNavItem,
} from "@/components/layout/dashboard-shell";
import { LoadingState } from "@/components/ui/state";
import { requireOwnerPage } from "@/lib/auth/guards";

const navItems: DashboardNavItem[] = [
  { href: "/owner", label: "نظرة عامة", icon: CalendarDays, exact: true },
  { href: "/owner/appointments", label: "الحجوزات", icon: Users },
  { href: "/owner/clinics", label: "العيادات", icon: Building2 },
  { href: "/owner/doctors", label: "الدكاترة", icon: Stethoscope },
  { href: "/owner/receptionists", label: "موظفي الاستقبال", icon: UserCog },
];

function OwnerLayoutFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-6">
      <LoadingState
        title="جاري التحقق من الحساب..."
        description="استنى لحظة وبنفتح لك لوحة صاحب الموقع."
      />
    </div>
  );
}

async function OwnerGuardedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireOwnerPage("/owner");

  return (
    <DashboardShell
      title="لوحة صاحب الموقع"
      subtitle="إدارة العيادات والدكاترة"
      navItems={navItems}
      userLabel={staff.name}
      roleLabel="صاحب الموقع"
      logoutSlot={<LogoutButton variant="sidebar" />}
      mobileLogoutSlot={<LogoutButton variant="header" />}
    >
      {children}
    </DashboardShell>
  );
}

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <React.Suspense fallback={<OwnerLayoutFallback />}>
      <OwnerGuardedShell>{children}</OwnerGuardedShell>
    </React.Suspense>
  );
}
