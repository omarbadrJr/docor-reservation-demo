"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Calendar, Clock, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatArabicDate } from "@/lib/format";
import { formatArabicTime } from "@/lib/schedule";
import {
  bookingFormSchema,
  type BookingFormValues,
} from "@/lib/validations/appointments";
import type { TimeSlot } from "@/types/availability";

export type BookingPatientFormProps = {
  selectedDate: string;
  selectedSlot: TimeSlot;
  serverError: string | null;
  serverFieldErrors?: Partial<Record<"patientName" | "patientPhone", string>>;
  isSubmitting: boolean;
  disabled?: boolean;
  onSubmit: (values: BookingFormValues) => Promise<void>;
};

export function BookingPatientForm({
  selectedDate,
  selectedSlot,
  serverError,
  serverFieldErrors,
  isSubmitting,
  disabled,
  onSubmit,
}: BookingPatientFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      patientName: "",
      patientPhone: "",
    },
  });

  const patientNameError =
    errors.patientName?.message ?? serverFieldErrors?.patientName;
  const patientPhoneError =
    errors.patientPhone?.message ?? serverFieldErrors?.patientPhone;
  const isFormDisabled = isSubmitting || Boolean(disabled);

  return (
    <section
      aria-labelledby="booking-form-heading"
      className="rounded-md border border-border bg-card p-5 sm:p-6"
    >
      <div>
        <h2
          id="booking-form-heading"
          className="font-heading text-xl font-extrabold sm:text-2xl"
        >
          بيانات المريض
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          اكتب اسمك ورقم موبايلك عشان نأكد الحجز.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-primary/25 bg-primary/10 px-4 py-3 text-sm font-bold text-foreground">
        <span className="inline-flex items-center gap-2">
          <Calendar className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{formatArabicDate(selectedDate)}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <Clock className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            {formatArabicTime(selectedSlot.start)} -{" "}
            {formatArabicTime(selectedSlot.end)}
          </span>
        </span>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-5 space-y-5"
      >
        {serverError ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold leading-6 text-destructive"
          >
            <AlertCircle
              className="mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            <p>{serverError}</p>
          </div>
        ) : null}

        <Field
          label="الاسم بالكامل"
          htmlFor="booking-patient-name"
          required
          error={patientNameError}
        >
          <Input
            id="booking-patient-name"
            type="text"
            autoComplete="name"
            placeholder="مثال: محمد أحمد علي"
            required
            disabled={isFormDisabled}
            aria-invalid={Boolean(patientNameError)}
            {...register("patientName")}
          />
        </Field>

        <Field
          label="رقم الموبايل"
          htmlFor="booking-patient-phone"
          required
          error={patientPhoneError}
        >
          <Input
            id="booking-patient-phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="tel"
            placeholder="01012345678"
            required
            disabled={isFormDisabled}
            aria-invalid={Boolean(patientPhoneError)}
            {...register("patientPhone")}
          />
        </Field>

        <Button
          type="submit"
          size="lg"
          disabled={isFormDisabled}
          className="w-full sm:w-auto sm:min-w-52"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              بنأكد الحجز...
            </>
          ) : (
            "أكّد الحجز"
          )}
        </Button>
      </form>
    </section>
  );
}
