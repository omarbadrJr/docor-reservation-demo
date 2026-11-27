"use client";

import {
  AlertCircle,
  Loader2,
  MapPin,
  PauseCircle,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Stamp,
  Stethoscope,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { ActiveStatusBadge } from "@/components/dashboard/active-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/state";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  parseCreateClinicInput,
  parseUpdateClinicInput,
} from "@/lib/validations/owner";
import type { OwnerClinic, OwnerErrorResponse } from "@/types/owner";

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

type ClinicFormState = {
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
};

const EMPTY_FORM: ClinicFormState = {
  name: "",
  address: "",
  phone: "",
  isActive: true,
};

const DEACTIVATION_NOTE =
  "لما تعطّل العيادة دي، الدكاترة اللي فيها مش هيظهروا للمرضى للحجوزات الجديدة، بس الحجوزات القديمة بتفضل محفوظة زي ما هي.";
const CONNECTION_ERROR_MESSAGE =
  "حصلت مشكلة في الاتصال بالخادم، اتأكد من الإنترنت وحاول تاني.";

function normalizeDigits(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x0660),
    )
    .replace(/[\u06f0-\u06f9]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    );
}

function sortClinicsByName(items: OwnerClinic[]): OwnerClinic[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

function formatDoctorCount(count: number): string {
  if (count === 0) {
    return "مفيش دكاترة مسجلين";
  }
  if (count === 1) {
    return "دكتور واحد";
  }
  if (count === 2) {
    return "دكتورين";
  }
  if (count <= 10) {
    return `${count} دكاترة`;
  }
  return `${count} دكتور`;
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export interface OwnerClinicsManagerProps {
  initialClinics: OwnerClinic[];
}

export function OwnerClinicsManager({
  initialClinics,
}: OwnerClinicsManagerProps) {
  const router = useRouter();
  const [prevInitialClinics, setPrevInitialClinics] = useState(initialClinics);
  const [clinics, setClinics] = useState<OwnerClinic[]>(() =>
    sortClinicsByName(initialClinics),
  );
  if (initialClinics !== prevInitialClinics) {
    setPrevInitialClinics(initialClinics);
    setClinics(sortClinicsByName(initialClinics));
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const [pendingDeactivateId, setPendingDeactivateId] = useState<string | null>(
    null,
  );
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<OwnerClinic | null>(null);
  const [formState, setFormState] = useState<ClinicFormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      setDialogOpen(false);
      setEditingClinic(null);
      setFormState(EMPTY_FORM);
      setFieldErrors({});
      setDialogError(null);
      setIsSubmitting(false);
      setPendingDeactivateId(null);
      setTogglingId(null);
      setBannerSuccess(null);
      setBannerError(null);
    };
  }, []);

  const activeCount = clinics.filter((clinic) => clinic.isActive).length;
  const inactiveCount = clinics.length - activeCount;

  const normalizedQuery = normalizeDigits(searchQuery).trim().toLowerCase();
  const filteredClinics = clinics.filter((clinic) => {
    if (statusFilter === "ACTIVE" && !clinic.isActive) {
      return false;
    }
    if (statusFilter === "INACTIVE" && clinic.isActive) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }

    const haystack = normalizeDigits(
      `${clinic.name} ${clinic.address} ${clinic.phone}`,
    ).toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  function openCreateDialog() {
    setEditingClinic(null);
    setFormState(EMPTY_FORM);
    setFieldErrors({});
    setDialogError(null);
    setBannerError(null);
    setDialogOpen(true);
  }

  function openEditDialog(clinic: OwnerClinic) {
    setEditingClinic(clinic);
    setFormState({
      name: clinic.name,
      address: clinic.address,
      phone: clinic.phone,
      isActive: clinic.isActive,
    });
    setFieldErrors({});
    setDialogError(null);
    setBannerError(null);
    setDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    if (isSubmitting) {
      return;
    }
    setDialogOpen(open);
    if (!open) {
      setEditingClinic(null);
      setFieldErrors({});
      setDialogError(null);
    }
  }

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setFieldErrors({});
    setDialogError(null);

    const payload = {
      name: formState.name,
      address: formState.address,
      phone: formState.phone,
      isActive: formState.isActive,
    };

    const parsed = editingClinic
      ? parseUpdateClinicInput(payload)
      : parseCreateClinicInput(payload);

    if (!parsed.success) {
      setFieldErrors(parsed.fieldErrors);
      setDialogError(parsed.message);
      return;
    }

    setIsSubmitting(true);

    try {
      const endpoint = editingClinic
        ? `/api/owner/clinics/${editingClinic.id}`
        : "/api/owner/clinics";
      const method = editingClinic ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        const errorBody = await parseJsonSafe<OwnerErrorResponse>(response);
        setFieldErrors(errorBody?.fieldErrors ?? {});
        setDialogError(errorBody?.error ?? CONNECTION_ERROR_MESSAGE);
        return;
      }

      const data = await parseJsonSafe<{ clinic?: OwnerClinic }>(response);
      if (!data?.clinic) {
        setDialogError(CONNECTION_ERROR_MESSAGE);
        return;
      }

      const savedClinic = data.clinic;
      setClinics((current) => {
        const next = editingClinic
          ? current.map((item) =>
              item.id === savedClinic.id ? savedClinic : item,
            )
          : [...current, savedClinic];
        return sortClinicsByName(next);
      });

      setPendingDeactivateId((current) =>
        current === savedClinic.id ? null : current,
      );
      setBannerError(null);
      setBannerSuccess(
        editingClinic
          ? `تم تحديث بيانات "${savedClinic.name}".`
          : `تمت إضافة "${savedClinic.name}".`,
      );
      setDialogOpen(false);
      setEditingClinic(null);
      router.refresh();
    } catch {
      setDialogError(CONNECTION_ERROR_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleActive(clinic: OwnerClinic, nextActive: boolean) {
    if (togglingId || isSubmitting) {
      return;
    }

    setTogglingId(clinic.id);
    setBannerError(null);
    setBannerSuccess(null);

    try {
      const response = await fetch(`/api/owner/clinics/${clinic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });

      if (!response.ok) {
        const errorBody = await parseJsonSafe<OwnerErrorResponse>(response);
        setBannerError(errorBody?.error ?? CONNECTION_ERROR_MESSAGE);
        return;
      }

      const data = await parseJsonSafe<{ clinic?: OwnerClinic }>(response);
      if (!data?.clinic) {
        setBannerError(CONNECTION_ERROR_MESSAGE);
        return;
      }

      const updatedClinic = data.clinic;
      setClinics((current) =>
        sortClinicsByName(
          current.map((item) =>
            item.id === updatedClinic.id ? updatedClinic : item,
          ),
        ),
      );
      setPendingDeactivateId(null);
      setBannerSuccess(
        updatedClinic.isActive
          ? `تم تفعيل "${updatedClinic.name}" وهتظهر للدكاترة والحجوزات الجديدة.`
          : `تم تعطيل "${updatedClinic.name}". الحجوزات القديمة لسه محفوظة زي ما هي.`,
      );
      router.refresh();
    } catch {
      setBannerError(CONNECTION_ERROR_MESSAGE);
    } finally {
      setTogglingId(null);
    }
  }

  const filterOptions: Array<{
    value: StatusFilter;
    label: string;
    count: number;
  }> = [
    { value: "ALL", label: "الكل", count: clinics.length },
    { value: "ACTIVE", label: "نشط", count: activeCount },
    { value: "INACTIVE", label: "غير نشط", count: inactiveCount },
  ];

  const isFiltered =
    normalizedQuery.length > 0 || statusFilter !== "ALL";

  return (
    <div className="space-y-6">
      <PageHeader
        title="العيادات"
        description="إدارة العيادات المسجلة على المنصة، وتحديث عناوينها وأرقام التليفون وحالة الظهور."
        action={
          <Button
            type="button"
            size="lg"
            onClick={openCreateDialog}
            className="w-full sm:w-auto"
          >
            <Plus className="size-5" aria-hidden="true" />
            إضافة عيادة جديدة
          </Button>
        }
      />

      {bannerSuccess ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start justify-between gap-3 rounded-md border border-primary/35 bg-card px-4 py-3.5 text-sm font-bold leading-6 text-foreground"
        >
          <div className="flex items-start gap-2.5">
            <Stamp
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p>{bannerSuccess}</p>
          </div>
          <button
            type="button"
            onClick={() => setBannerSuccess(null)}
            aria-label="إخفاء الرسالة"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {bannerError ? (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-sm font-semibold leading-6 text-destructive"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle
              className="mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            <p>{bannerError}</p>
          </div>
          <button
            type="button"
            onClick={() => setBannerError(null)}
            aria-label="إخفاء رسالة الخطأ"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-destructive hover:bg-destructive/15"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {clinics.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between sm:pt-6">
            <div className="relative flex-1">
              <label htmlFor="clinics-search" className="sr-only">
                ابحث باسم العيادة أو العنوان أو رقم التليفون
              </label>
              <Search
                className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="clinics-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="دور باسم العيادة أو العنوان أو التليفون..."
                className="pr-11 pl-13"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="مسح البحث"
                  className="absolute top-1/2 left-1 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <div
              role="group"
              aria-label="فلترة العيادات حسب الحالة"
              className="flex flex-wrap gap-2"
            >
              {filterOptions.map((option) => {
                const isSelected = statusFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setStatusFilter(option.value)}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-md border px-3.5 text-sm font-bold transition-colors",
                      isSelected
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-foreground hover:bg-muted",
                    )}
                  >
                    <span>{option.label}</span>
                    <span
                      className={cn(
                        "tabular-nums text-xs",
                        isSelected
                          ? "text-background/80"
                          : "text-muted-foreground",
                      )}
                    >
                      ({option.count})
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {clinics.length === 0 ? (
        <EmptyState
          title="لسه مفيش عيادات مسجلة"
          description="ابدأ بإضافة أول عيادة عشان تقدر تضيف الدكاترة وموظفي الاستقبال."
          action={
            <Button type="button" size="lg" onClick={openCreateDialog}>
              <Plus className="size-5" aria-hidden="true" />
              إضافة عيادة جديدة
            </Button>
          }
        />
      ) : filteredClinics.length === 0 ? (
        <EmptyState
          title="مفيش عيادات مطابقة لبحثك"
          description="جرّب تغيّر كلمة البحث أو ترجّع الفلتر لعرض كل العيادات."
          action={
            isFiltered ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                }}
              >
                عرض كل العيادات
              </Button>
            ) : null
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredClinics.map((clinic) => {
            const isTogglingThis = togglingId === clinic.id;
            const isConfirmingDeactivate = pendingDeactivateId === clinic.id;

            return (
              <li key={clinic.id} className="flex">
                <Card className="flex w-full flex-col">
                  <CardHeader className="flex-row items-start justify-between gap-3 border-b border-dashed border-border pb-4">
                    <CardTitle className="min-w-0 leading-snug text-foreground">
                      {clinic.name}
                    </CardTitle>
                    <ActiveStatusBadge
                      isActive={clinic.isActive}
                      className="shrink-0"
                    />
                  </CardHeader>

                  <CardContent className="flex-1 space-y-4 pt-4">
                    <dl className="space-y-3 text-sm">
                      <div className="space-y-1">
                        <dt className="flex items-center gap-1.5 font-bold text-muted-foreground">
                          <MapPin className="size-4 shrink-0" aria-hidden="true" />
                          <span>عنوان العيادة</span>
                        </dt>
                        <dd className="leading-7 font-semibold text-foreground">
                          {clinic.address}
                        </dd>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <dt className="flex items-center gap-1.5 font-bold text-muted-foreground">
                            <Phone
                              className="size-4 shrink-0"
                              aria-hidden="true"
                            />
                            <span>رقم التليفون</span>
                          </dt>
                          <dd
                            dir="ltr"
                            className="w-fit font-bold tabular-nums text-foreground"
                          >
                            {clinic.phone}
                          </dd>
                        </div>

                        <div className="space-y-1">
                          <dt className="flex items-center gap-1.5 font-bold text-muted-foreground">
                            <Stethoscope
                              className="size-4 shrink-0"
                              aria-hidden="true"
                            />
                            <span>الدكاترة</span>
                          </dt>
                          <dd className="font-bold tabular-nums text-foreground">
                            {formatDoctorCount(clinic.doctorCount)}
                          </dd>
                        </div>
                      </div>
                    </dl>

                    {!clinic.isActive ? (
                      <p className="rounded-md border border-border bg-muted/40 px-3.5 py-2.5 text-xs font-semibold leading-6 text-muted-foreground">
                        العيادة دي متعطلة دلوقتي؛ الدكاترة اللي فيها مش هيظهروا
                        للحجوزات الجديدة، والحجوزات القديمة محفوظة.
                      </p>
                    ) : null}
                  </CardContent>

                  <CardFooter className="flex-col items-stretch gap-3 border-dashed border-border">
                    {isConfirmingDeactivate ? (
                      <div className="space-y-3 rounded-md border border-destructive/25 bg-destructive/10 p-3.5">
                        <p className="text-xs font-bold leading-6 text-foreground">
                          {DEACTIVATION_NOTE}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={togglingId !== null || isSubmitting}
                            onClick={() => handleToggleActive(clinic, false)}
                          >
                            {isTogglingThis ? (
                              <>
                                <Loader2
                                  className="size-4 animate-spin"
                                  aria-hidden="true"
                                />
                                بنعطّل...
                              </>
                            ) : (
                              "تأكيد التعطيل"
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={togglingId !== null}
                            onClick={() => setPendingDeactivateId(null)}
                          >
                            تراجع
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={togglingId !== null || isSubmitting}
                          onClick={() => openEditDialog(clinic)}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                          تعديل البيانات
                        </Button>

                        {clinic.isActive ? (
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={togglingId !== null || isSubmitting}
                            onClick={() => setPendingDeactivateId(clinic.id)}
                          >
                            <PauseCircle
                              className="size-4"
                              aria-hidden="true"
                            />
                            تعطيل العيادة
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={togglingId !== null || isSubmitting}
                            onClick={() => handleToggleActive(clinic, true)}
                          >
                            {isTogglingThis ? (
                              <>
                                <Loader2
                                  className="size-4 animate-spin"
                                  aria-hidden="true"
                                />
                                بنفعّل...
                              </>
                            ) : (
                              <>
                                <RotateCcw
                                  className="size-4"
                                  aria-hidden="true"
                                />
                                تفعيل العيادة
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </CardFooter>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingClinic ? "تعديل بيانات العيادة" : "إضافة عيادة جديدة"}
            </DialogTitle>
            <DialogDescription>
              {editingClinic
                ? "عدّل الاسم أو العنوان أو رقم التليفون واضغط حفظ."
                : "اكتب اسم العيادة وعنوانها ورقم تليفونها عشان تضيفها على المنصة."}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleFormSubmit}
            noValidate
            className="mt-5 space-y-4"
          >
            {dialogError ? (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold leading-6 text-destructive"
              >
                <AlertCircle
                  className="mt-0.5 size-5 shrink-0"
                  aria-hidden="true"
                />
                <p>{dialogError}</p>
              </div>
            ) : null}

            <Field
              label="اسم العيادة"
              htmlFor="clinic-name"
              required
              error={fieldErrors.name}
            >
              <Input
                id="clinic-name"
                type="text"
                value={formState.name}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="مثال: عيادة النيل التخصصية"
                maxLength={120}
                required
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.name)}
              />
            </Field>

            <Field
              label="عنوان العيادة"
              htmlFor="clinic-address"
              required
              error={fieldErrors.address}
            >
              <Textarea
                id="clinic-address"
                value={formState.address}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
                placeholder="مثال: شارع الجمهورية أمام مجلس المدينة، دمنهور"
                maxLength={240}
                required
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.address)}
              />
            </Field>

            <Field
              label="رقم التليفون"
              htmlFor="clinic-phone"
              hint="اكتب الرقم الأرضي أو الموبايل اللي المرضى يتواصلوا عليه."
              required
              error={fieldErrors.phone}
            >
              <Input
                id="clinic-phone"
                type="tel"
                inputMode="tel"
                dir="ltr"
                value={formState.phone}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="0453311223"
                maxLength={20}
                required
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.phone)}
                className="text-left"
              />
            </Field>

            <div className="space-y-2 rounded-md border border-border bg-background/60 p-3.5">
              <label
                htmlFor="clinic-is-active"
                className="flex cursor-pointer items-center gap-3 text-sm font-bold text-foreground"
              >
                <input
                  id="clinic-is-active"
                  type="checkbox"
                  checked={formState.isActive}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                  className="size-5 rounded border-input accent-primary"
                />
                <span>العيادة نشطة وبتظهر للمرضى</span>
              </label>

              {!formState.isActive ? (
                <p className="text-xs font-semibold leading-6 text-muted-foreground">
                  {DEACTIVATION_NOTE}
                </p>
              ) : null}

              {fieldErrors.isActive ? (
                <p
                  role="alert"
                  className="text-sm font-semibold text-destructive"
                >
                  {fieldErrors.isActive}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2
                      className="size-5 animate-spin"
                      aria-hidden="true"
                    />
                    بنحفظ...
                  </>
                ) : editingClinic ? (
                  "حفظ التعديلات"
                ) : (
                  "إضافة العيادة"
                )}
              </Button>

              <DialogClose
                type="button"
                disabled={isSubmitting}
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                )}
              >
                إلغاء
              </DialogClose>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
