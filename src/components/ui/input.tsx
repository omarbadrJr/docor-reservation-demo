import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-12 w-full rounded-xl border border-input bg-card px-4 py-2 text-base text-foreground shadow-[0_1px_0_rgba(15,95,92,0.04)] transition-colors outline-none",
        "placeholder:text-muted-foreground/80",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
