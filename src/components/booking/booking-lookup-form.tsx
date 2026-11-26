"use client";

import { Hash, Loader2, Phone, Search } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  normalizePhoneNumber,
  normalizeReferenceNumber,
  phoneLookupSchema,
  referenceLookupSchema,
} from "@/lib/validations/appointments";
import type { LookupAppointmentQuery } from "@/types/booking";

export type LookupMode = "reference" | "phone";

export type BookingLookupFormProps = {
  mode: LookupMode;
  value: string;
  isLoading: boolean;
  error: string | null;
  onModeChange: (mode: LookupMode) => void;
  onValueChange: (value: string) => void;
  onSubmit: (query: LookupAppointmentQuery) => void;
};

export function BookingLookupForm({
  mode,
  value,
  isLoading,
  error,
  onModeChange,
  onValueChange,
  onSubmit,
}: BookingLookupFormProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const displayError = localError ?? error;

  function handleModeSelect(nextMode: LookupMode) {
    if (nextMode === mode) {
      return;
    }
    setLocalError(null);
    onModeChange(nextMode);
  }

  function handleInputChange(nextValue: string) {
    if (localError) {
      setLocalError(null);
    }
    onValueChange(nextValue);
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) {
      return;
    }

    if (mode === "reference") {
      const parsed = referenceLookupSchema.safeParse({ reference: value });
      if (!parsed.success) {
        setLocalError(
          parsed.error.issues[0]?.message ??
            "اكتب رقم الحجز صح (مثلاً DR-8K29P4).",
        );
        return;
      }
      setLocalError(null);
      onSubmit({
        type: "reference",
        reference: normalizeReferenceNumber(parsed.data.reference),
      });
      return;
    }

    const parsed = phoneLookupSchema.safeParse({ phone: value });
    if (!parsed.success) {
      setLocalError(
        parsed.error.issues[0]?.message ??
          "اكتب رقم موبايل صح (أرقام بس، من 7 لـ 20 رقم).",
      );
      return;
    }
    setLocalError(null);
    onSubmit({
      type: "phone",
      phone: normalizePhoneNumber(parsed.data.phone),
    });
  }

  const isReference = mode === "reference";

  return (
    <section
      aria-labelledby="booking-lookup-heading"
      className="rounded-md border border-border bg-card p-5 sm:p-6"
    >
      <div>
        <h2
          id="booking-lookup-heading"
          className="font-heading text-xl font-extrabold sm:text-2xl"
        >
          دوّر على حجزك
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          اختار تدور برقم الحجز أو برقم الموبايل اللي حجزت بيه.
        </p>
      </div>

      <div
        role="group"
        aria-label="طريقة البحث عن الحجز"
        className="mt-5 grid grid-cols-2 gap-3"
      >
        <button
          type="button"
          aria-pressed={isReference}
          disabled={isLoading}
          onClick={() => handleModeSelect("reference")}
          className={cn(
            "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-base font-bold transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
            isReference
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground hover:border-primary/60 hover:bg-primary/5",
          )}
        >
          <Hash className="size-4 shrink-0" aria-hidden="true" />
          <span>برقم الحجز</span>
        </button>

        <button
          type="button"
          aria-pressed={!isReference}
          disabled={isLoading}
          onClick={() => handleModeSelect("phone")}
          className={cn(
            "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-base font-bold transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
            !isReference
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground hover:border-primary/60 hover:bg-primary/5",
          )}
        >
          <Phone className="size-4 shrink-0" aria-hidden="true" />
          <span>برقم الموبايل</span>
        </button>
      </div>

      <form onSubmit={handleFormSubmit} noValidate className="mt-5 space-y-4">
        <Field
          label={isReference ? "رقم الحجز" : "رقم الموبايل"}
          htmlFor="booking-lookup-input"
          hint={
            isReference
              ? "هتلاقي رقم الحجز في رسالة أو صورة التأكيد، زي DR-8K29P4."
              : "اكتب رقم الموبايل اللي سجّلته وقت الحجز."
          }
          error={displayError ?? undefined}
          required
        >
          <Input
            id="booking-lookup-input"
            name={isReference ? "reference" : "phone"}
            type={isReference ? "text" : "tel"}
            inputMode={isReference ? "text" : "tel"}
            autoComplete={isReference ? "off" : "tel"}
            dir="ltr"
            placeholder={isReference ? "DR-8K29P4" : "01012345678"}
            value={value}
            disabled={isLoading}
            aria-invalid={Boolean(displayError)}
            onChange={(event) => handleInputChange(event.target.value)}
          />
        </Field>

        <Button
          type="submit"
          size="lg"
          disabled={isLoading}
          className="w-full sm:w-auto sm:min-w-52"
        >
          {isLoading ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              بندور على الحجز...
            </>
          ) : (
            <>
              <Search className="size-5" aria-hidden="true" />
              دوّر على حجزك
            </>
          )}
        </Button>
      </form>
    </section>
  );
}
