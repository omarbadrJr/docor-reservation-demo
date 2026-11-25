import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
};

function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  return (
    <div data-slot="field" className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm leading-6 text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export { Field };
