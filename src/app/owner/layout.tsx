import {
  Building2,
  CalendarDays,
  Stethoscope,
  UserCog,
  Users,
} from "lucide-react";
import * as React from "react";

import {
  DashboardShell,
  type DashboardNavItem,
} from "@/components/layout/dashboard-shell";

const navItems: DashboardNavItem[] = [
  { href: "/owner", label: "نظرة عامة", icon: CalendarDays },
  { href: "/owner/appointments", label: "الحجوزات", icon: Users },
  { href: "/owner/clinics", label: "العيادات", icon: Building2 },
  { href: "/owner/doctors", label: "الدكاترة", icon: Stethoscope },
  { href: "/owner/receptionists", label: "موظفي الاستقبال", icon: UserCog },
];

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      title="لوحة صاحب الموقع"
      subtitle="إدارة العيادات والدكاترة"
      navItems={navItems}
      userLabel="صاحب الموقع"
      roleLabel="صلاحيات كاملة"
    >
      {children}
    </DashboardShell>
  );
}
