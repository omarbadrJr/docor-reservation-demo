import { CalendarDays, ClipboardCheck, Users } from "lucide-react";
import * as React from "react";

import {
  DashboardShell,
  type DashboardNavItem,
} from "@/components/layout/dashboard-shell";

const navItems: DashboardNavItem[] = [
  { href: "/receptionist", label: "مواعيد النهارده", icon: CalendarDays },
  { href: "/receptionist/appointments", label: "كل الحجوزات", icon: Users },
  { href: "/receptionist/check-in", label: "تسجيل وصول", icon: ClipboardCheck },
];

export default function ReceptionistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      title="لوحة الاستقبال"
      subtitle="عيادة النموذج التجريبي"
      navItems={navItems}
      userLabel="موظف الاستقبال"
      roleLabel="عيادة واحدة"
    >
      {children}
    </DashboardShell>
  );
}
