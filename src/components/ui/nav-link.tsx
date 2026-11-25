"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  exact?: boolean;
};

function NavLink({
  href,
  children,
  className,
  activeClassName = "bg-primary/10 text-primary",
  inactiveClassName = "text-muted-foreground hover:bg-muted hover:text-foreground",
  exact = false,
}: NavLinkProps) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors",
        active ? activeClassName : inactiveClassName,
        className,
      )}
    >
      {children}
    </Link>
  );
}

export { NavLink };
