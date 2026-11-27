"use client";

import {
  AlertCircle,
  Loader2,
  RotateCcw,
  Search,
  Stamp,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ReceptionistAppointmentCard } from "@/components/dashboard/receptionist-appointment-card";
import { ReceptionistQrScanner } from "@/components/dashboard/receptionist-qr-scanner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EmptyState, LoadingState } from "@/components/ui/state";
import { parseScannedOrTypedBookingCode } from "@/lib/validations/receptionist";
import type {
  ReceptionistAppointment,
  ReceptionistErrorResponse,
  ReceptionistStatusTarget,
} from "@/types/receptionist";

const LOOKUP_CONNECTION_ERROR =
  "حصلت مشكلة وإحنا بندور على الحجز، اتأكد من الإنترنت وحاول تاني.";
const ACTION_CONNECTION_ERROR =
  "حصلت مشكلة وإحنا بنحدّث الحجز، اتأكد من الإنترنت وحاول تاني.";

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export interface ReceptionistCheckInViewProps {
  clinicName: string;
  initialReference?: string;
  initialAppointment?: ReceptionistAppointment | null;
  initialError?: string | null;
}

export function ReceptionistCheckInView({
  clinicName,
  initialReference = "",
  initialAppointment = null,
  initialError = null,
}: ReceptionistCheckInViewProps) {
  const router = useRouter();
  const incomingKey = `${initialReference}:${initialAppointment?.id ?? ""}:${initialError ?? ""}`;
  const [prevIncomingKey, setPrevIncomingKey] = useState(incomingKey);

  const [codeInput, setCodeInput] = useState(initialReference);
  const [appointment, setAppointment] =
    useState<ReceptionistAppointment | null>(initialAppointment);
  const [lookupError, setLookupError] = useState<string | null>(initialError);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const [pendingAction, setPendingAction] =
    useState<ReceptionistStatusTarget | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (incomingKey !== prevIncomingKey) {
    setPrevIncomingKey(incomingKey);
    setCodeInput(initialReference);
    setAppointment(initialAppointment);
    setLookupError(initialError);
    setFieldError(null);
    setActionSuccess(null);
    setActionError(null);
  }

  const lookupAbortRef = useRef<AbortController | null>(null);
  const lookupSeqRef = useRef(0);

  useEffect(() => {
    return () => {
      lookupAbortRef.current?.abort();
      lookupAbortRef.current = null;
      setIsLookingUp(false);
      setPendingAction(null);
      setActionSuccess(null);
      setActionError(null);
    };
  }, []);

  async function runLookup(rawCode: string) {
    const parsed = parseScannedOrTypedBookingCode(rawCode);
    if (parsed.type === "invalid") {
      setFieldError(parsed.message);
      setLookupError(null);
      setActionSuccess(null);
      setActionError(null);
      return;
    }

    if (parsed.type === "reference") {
      setCodeInput(parsed.value);
    } else {
      setCodeInput(parsed.value);
    }

    lookupAbortRef.current?.abort();
    const controller = new AbortController();
    lookupAbortRef.current = controller;
    lookupSeqRef.current += 1;
    const sequence = lookupSeqRef.current;

    setFieldError(null);
    setLookupError(null);
    setActionSuccess(null);
    setActionError(null);
    setIsLookingUp(true);

    const endpoint =
      parsed.type === "reference"
        ? `/api/receptionist/appointments/${encodeURIComponent(parsed.value)}`
        : `/api/receptionist/appointments/lookup?qrToken=${encodeURIComponent(parsed.value)}`;

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });

      const payload = await parseJsonSafe<
        { appointment?: ReceptionistAppointment } & Partial<ReceptionistErrorResponse>
      >(response);

      if (controller.signal.aborted || sequence !== lookupSeqRef.current) {
        return;
      }

      if (!response.ok || !payload?.appointment) {
        setAppointment(null);
        setLookupError(payload?.error ?? LOOKUP_CONNECTION_ERROR);
        return;
      }

      setAppointment(payload.appointment);
      setCodeInput(payload.appointment.referenceNumber);
    } catch (error) {
      if (
        (error instanceof Error && error.name === "AbortError") ||
        controller.signal.aborted ||
        sequence !== lookupSeqRef.current
      ) {
        return;
      }

      setAppointment(null);
      setLookupError(LOOKUP_CONNECTION_ERROR);
    } finally {
      if (!controller.signal.aborted && sequence === lookupSeqRef.current) {
        setIsLookingUp(false);
      }
    }
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runLookup(codeInput);
  }

  function handleResetLookup() {
    lookupAbortRef.current?.abort();
    lookupAbortRef.current = null;
    setIsLookingUp(false);
    setCodeInput("");
    setAppointment(null);
    setFieldError(null);
    setLookupError(null);
    setActionSuccess(null);
    setActionError(null);
  }

  async function handleCheckIn(target: ReceptionistAppointment) {
    if (pendingAction || isLookingUp) {
      return;
    }

    setActionSuccess(null);
    setActionError(null);
    setPendingAction("CHECKED_IN");

    try {
      const response = await fetch(
        `/api/receptionist/appointments/${encodeURIComponent(target.referenceNumber)}/check-in`,
        {
          method: "POST",
        },
      );

      const payload = await parseJsonSafe<
        { appointment?: ReceptionistAppointment } & Partial<ReceptionistErrorResponse>
      >(response);

      if (!response.ok || !payload?.appointment) {
        setActionError(payload?.error ?? ACTION_CONNECTION_ERROR);
        return;
      }

      setAppointment(payload.appointment);
      setActionSuccess(
        `تم تسجيل وصول "${payload.appointment.patientName}" (${payload.appointment.referenceNumber}) بنجاح.`,
      );
      router.refresh();
    } catch {
      setActionError(ACTION_CONNECTION_ERROR);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUpdateStatus(
    target: ReceptionistAppointment,
    nextStatus: Exclude<ReceptionistStatusTarget, "CHECKED_IN">,
  ) {
    if (pendingAction || isLookingUp) {
      return;
    }

    setActionSuccess(null);
    setActionError(null);
    setPendingAction(nextStatus);

    try {
      const response = await fetch(
        `/api/receptionist/appointments/${encodeURIComponent(target.referenceNumber)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        },
      );

      const payload = await parseJsonSafe<
        { appointment?: ReceptionistAppointment } & Partial<ReceptionistErrorResponse>
      >(response);

      if (!response.ok || !payload?.appointment) {
        setActionError(payload?.error ?? ACTION_CONNECTION_ERROR);
        return;
      }

      setAppointment(payload.appointment);
      setActionSuccess(
        nextStatus === "COMPLETED"
          ? `تم إنهاء كشف "${payload.appointment.patientName}" بنجاح.`
          : `تم تسجيل "${payload.appointment.patientName}" كـ ما حضرش.`,
      );
      router.refresh();
    } catch {
      setActionError(ACTION_CONNECTION_ERROR);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="تسجيل وصول المريض"
        description={`${clinicName} — دوّر برقم الحجز أو امسح كود QR، واتأكد من بيانات المريض قبل تسجيل الوصول.`}
      />

      <Card className="p-5 sm:p-6">
        <form onSubmit={handleSearchSubmit} noValidate className="space-y-4">
          <Field
            label="رقم الحجز أو كود QR"
            htmlFor="receptionist-checkin-code"
            hint="اكتب رقم الحجز زي DR-8K29P4 أو وجّه جهاز قارئ QR على الخانة."
            error={fieldError ?? undefined}
          >
            <div className="relative">
              <Input
                id="receptionist-checkin-code"
                type="text"
                dir="ltr"
                autoComplete="off"
                placeholder="DR-8K29P4"
                value={codeInput}
                disabled={isLookingUp || pendingAction !== null}
                aria-invalid={Boolean(fieldError)}
                className="pl-13 text-left font-mono font-bold"
                onChange={(event) => {
                  setCodeInput(event.target.value);
                  if (fieldError) {
                    setFieldError(null);
                  }
                }}
              />
              {codeInput ? (
                <button
                  type="button"
                  onClick={handleResetLookup}
                  aria-label="مسح رقم الحجز"
                  className="absolute top-1/2 left-1 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={isLookingUp || pendingAction !== null}
            >
              {isLookingUp ? (
                <>
                  <Loader2
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                  بندور على الحجز...
                </>
              ) : (
                <>
                  <Search className="size-4" aria-hidden="true" />
                  بحث عن الحجز
                </>
              )}
            </Button>

            {appointment || lookupError || codeInput ? (
              <Button
                type="button"
                variant="outline"
                disabled={isLookingUp || pendingAction !== null}
                onClick={handleResetLookup}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                بحث جديد
              </Button>
            ) : null}
          </div>
        </form>

        <div
          className="my-6 border-t border-dashed border-border"
          aria-hidden="true"
        />

        <ReceptionistQrScanner
          disabled={isLookingUp || pendingAction !== null}
          onScan={(rawValue) => void runLookup(rawValue)}
        />
      </Card>

      {actionSuccess ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col gap-3 rounded-md border border-primary/35 bg-card px-4 py-3.5 text-sm leading-6 font-bold text-foreground sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <Stamp
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p>{actionSuccess}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleResetLookup}
          >
            تسجيل مريض تاني
          </Button>
        </div>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-sm leading-6 font-semibold text-destructive"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{actionError}</p>
        </div>
      ) : null}

      {isLookingUp ? (
        <LoadingState
          title="بندور على الحجز..."
          description="استنى لحظة وبنجيب لك بيانات المريض والميعاد."
        />
      ) : lookupError ? (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm leading-6 font-semibold text-destructive"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{lookupError}</p>
        </div>
      ) : appointment ? (
        <section
          aria-labelledby="receptionist-checkin-result-heading"
          className="space-y-3"
        >
          <h2
            id="receptionist-checkin-result-heading"
            className="font-heading text-xl font-extrabold text-foreground"
          >
            بيانات الحجز
          </h2>

          <ReceptionistAppointmentCard
            appointment={appointment}
            pendingAction={pendingAction}
            onCheckIn={handleCheckIn}
            onUpdateStatus={handleUpdateStatus}
          />
        </section>
      ) : (
        <EmptyState
          title="جاهز لتسجيل وصول المريض"
          description="اكتب رقم الحجز أو امسح كود QR من موبايل المريض عشان تشوف بياناته وتسجّل وصوله."
        />
      )}
    </div>
  );
}
