import { CalendarDays, ClipboardCheck, Users } from "lucide-react";
import * as React from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import {
  DashboardShell,
  type DashboardNavItem,
} from "@/components/layout/dashboard-shell";
import { LoadingState } from "@/components/ui/state";
import { requireReceptionistPage } from "@/lib/auth/guards";

const navItems: DashboardNavItem[] = [
  { href: "/receptionist", label: "مواعيد النهارده", icon: CalendarDays, exact: true },
  { href: "/receptionist/appointments", label: "كل الحجوزات", icon: Users },
  { href: "/receptionist/check-in", label: "تسجيل وصول", icon: ClipboardCheck },
];

function ReceptionistLayoutFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-6">
      <LoadingState
        title="جاري التحقق من الحساب..."
        description="استنى لحظة وبنفتح لك لوحة الاستقبال."
      />
    </div>
  );
}

async function ReceptionistGuardedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireReceptionistPage("/receptionist");

  return (
    <DashboardShell
      title="لوحة الاستقبال"
      subtitle={staff.clinicName ?? "العيادة المعينة"}
      navItems={navItems}
      userLabel={staff.name}
      roleLabel="موظف الاستقبال"
      logoutSlot={<LogoutButton variant="sidebar" />}
      mobileLogoutSlot={<LogoutButton variant="header" />}
    >
      {children}
    </DashboardShell>
  );
}

export default function ReceptionistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <React.Suspense fallback={<ReceptionistLayoutFallback />}>
      <ReceptionistGuardedShell>{children}</ReceptionistGuardedShell>
    </React.Suspense>
  );
}
