import Link from "next/link";
import { Stethoscope } from "lucide-react";
import * as React from "react";

import { buttonVariants } from "@/components/ui/button";
import { NavLink } from "@/components/ui/nav-link";
import { cn } from "@/lib/utils";

const navLinkClassName = "min-h-11 rounded-md";
const navActiveClassName = "bg-white/10 text-background";
const navInactiveClassName =
  "text-background/70 hover:bg-white/10 hover:text-background";

function PatientShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-white/15 bg-foreground text-background">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-3 rounded-md focus-visible:ring-3 focus-visible:ring-white/30 focus-visible:outline-none"
          >
            <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Stethoscope className="size-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-heading text-lg font-extrabold">
                حجز دكتور
              </span>
              <span className="mt-1 text-xs font-medium text-background/70">
                عيادات البحيرة
              </span>
            </span>
          </Link>

          <nav
            aria-label="التنقل الرئيسي"
            className="hidden items-center gap-1 sm:flex"
          >
            <NavLink
              href="/"
              exact
              className={navLinkClassName}
              activeClassName={navActiveClassName}
              inactiveClassName={navInactiveClassName}
            >
              الرئيسية
            </NavLink>
            <NavLink
              href="/specialties"
              className={navLinkClassName}
              activeClassName={navActiveClassName}
              inactiveClassName={navInactiveClassName}
            >
              التخصصات
            </NavLink>
            <NavLink
              href="/my-booking"
              className={navLinkClassName}
              activeClassName={navActiveClassName}
              inactiveClassName={navInactiveClassName}
            >
              حجزي
            </NavLink>
          </nav>

          <Link
            href="/my-booking"
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "border-white/25 bg-transparent text-background hover:bg-white/10 hover:text-background sm:hidden",
            )}
          >
            حجزي
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>حجز دكتور — خدمة تجريبية لعيادات في البحيرة.</p>
          <p>من غير حساب. الحجز بيتم في خطوات بسيطة.</p>
        </div>
      </footer>
    </div>
  );
}

export { PatientShell };
