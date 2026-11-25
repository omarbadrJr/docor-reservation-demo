import Link from "next/link";
import { Stethoscope, type LucideIcon } from "lucide-react";
import * as React from "react";

import { NavLink } from "@/components/ui/nav-link";

type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type DashboardShellProps = {
  title: string;
  subtitle?: string;
  navItems: DashboardNavItem[];
  userLabel: string;
  roleLabel: string;
  children: React.ReactNode;
};

const navClassName = "flex items-center gap-3 rounded-md px-3 py-3 text-sm";
const navActiveClassName =
  "bg-sidebar-accent text-sidebar-accent-foreground";
const navInactiveClassName =
  "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

function DashboardShell({
  title,
  subtitle,
  navItems,
  userLabel,
  roleLabel,
  children,
}: DashboardShellProps) {
  return (
    <div className="min-h-dvh bg-muted/40 lg:grid lg:grid-cols-[18rem_1fr]">
      <aside className="hidden bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <span className="flex size-10 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Stethoscope className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-base font-extrabold">{title}</p>
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs text-sidebar-foreground/60">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <nav aria-label="تنقل لوحة التحكم" className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                href={item.href}
                className={navClassName}
                activeClassName={navActiveClassName}
                inactiveClassName={navInactiveClassName}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <p className="text-sm font-bold">{userLabel}</p>
          <p className="mt-1 text-xs text-sidebar-foreground/60">
            {roleLabel}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 border-b border-white/15 bg-foreground text-background lg:hidden">
          <div className="flex h-16 items-center justify-between gap-4 px-4">
            <Link href="/" className="flex min-h-11 items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Stethoscope className="size-4" aria-hidden="true" />
              </span>
              <span className="font-heading text-base font-extrabold">
                {title}
              </span>
            </Link>
            <div className="text-left">
              <p className="text-sm font-bold">{userLabel}</p>
              <p className="text-[0.7rem] text-background/70">{roleLabel}</p>
            </div>
          </div>

          <nav
            aria-label="تنقل لوحة التحكم"
            className="flex flex-wrap gap-2 px-3 pb-3"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  className="min-h-11 shrink-0 rounded-md border border-white/20 px-3 py-2"
                  activeClassName="border-primary bg-primary text-primary-foreground"
                  inactiveClassName="border-white/20 bg-transparent text-background/75 hover:bg-white/10 hover:text-background"
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}

export { DashboardShell, type DashboardNavItem };
