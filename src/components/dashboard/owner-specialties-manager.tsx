"use client";

import {
  AlertCircle,
  FileText,
  Loader2,
  PauseCircle,
  Pencil,
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
  parseCreateSpecialtyInput,
  parseUpdateSpecialtyInput,
} from "@/lib/validations/owner";
import type { OwnerErrorResponse, OwnerSpecialty } from "@/types/owner";

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

type SpecialtyFormState = {
  name: string;
  description: string;
  isActive: boolean;
};

const EMPTY_FORM: SpecialtyFormState = {
  name: "",
  description: "",
  isActive: true,
};

const DEACTIVATION_NOTE =
  "لما تعطّل التخصص ده، مش هيظهر للمرضى في صفحة الحجز الجديدة، بس الحجوزات القديمة بتفضل محفوظة زي ما هي.";
const CONNECTION_ERROR_MESSAGE =
  "حصلت مشكلة في الاتصال بالخادم، اتأكد من الإنترنت وحاول تاني.";

function sortSpecialtiesByName(items: OwnerSpecialty[]): OwnerSpecialty[] {
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

export interface OwnerSpecialtiesManagerProps {
  initialSpecialties: OwnerSpecialty[];
}

export function OwnerSpecialtiesManager({
  initialSpecialties,
}: OwnerSpecialtiesManagerProps) {
  const router = useRouter();
  const [prevInitialSpecialties, setPrevInitialSpecialties] =
    useState(initialSpecialties);
  const [specialties, setSpecialties] = useState<OwnerSpecialty[]>(() =>
    sortSpecialtiesByName(initialSpecialties),
  );
  if (initialSpecialties !== prevInitialSpecialties) {
    setPrevInitialSpecialties(initialSpecialties);
    setSpecialties(sortSpecialtiesByName(initialSpecialties));
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
  const [editingSpecialty, setEditingSpecialty] =
    useState<OwnerSpecialty | null>(null);
  const [formState, setFormState] = useState<SpecialtyFormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      setDialogOpen(false);
      setEditingSpecialty(null);
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

  const activeCount = specialties.filter((item) => item.isActive).length;
  const inactiveCount = specialties.length - activeCount;

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredSpecialties = specialties.filter((specialty) => {
    if (statusFilter === "ACTIVE" && !specialty.isActive) {
      return false;
    }
    if (statusFilter === "INACTIVE" && specialty.isActive) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }

    const haystack = `${specialty.name} ${specialty.description ?? ""}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  function openCreateDialog() {
    setEditingSpecialty(null);
    setFormState(EMPTY_FORM);
    setFieldErrors({});
    setDialogError(null);
    setBannerError(null);
    setDialogOpen(true);
  }

  function openEditDialog(specialty: OwnerSpecialty) {
    setEditingSpecialty(specialty);
    setFormState({
      name: specialty.name,
      description: specialty.description ?? "",
      isActive: specialty.isActive,
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
      setEditingSpecialty(null);
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
      description: formState.description.trim()
        ? formState.description.trim()
        : null,
      isActive: formState.isActive,
    };

    const parsed = editingSpecialty
      ? parseUpdateSpecialtyInput(payload)
      : parseCreateSpecialtyInput(payload);

    if (!parsed.success) {
      setFieldErrors(parsed.fieldErrors);
      setDialogError(parsed.message);
      return;
    }

    setIsSubmitting(true);

    try {
      const endpoint = editingSpecialty
        ? `/api/owner/specialties/${editingSpecialty.id}`
        : "/api/owner/specialties";
      const method = editingSpecialty ? "PATCH" : "POST";

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

      const data = await parseJsonSafe<{ specialty?: OwnerSpecialty }>(
        response,
      );
      if (!data?.specialty) {
        setDialogError(CONNECTION_ERROR_MESSAGE);
        return;
      }

      const savedSpecialty = data.specialty;
      setSpecialties((current) => {
        const next = editingSpecialty
          ? current.map((item) =>
              item.id === savedSpecialty.id ? savedSpecialty : item,
            )
          : [...current, savedSpecialty];
        return sortSpecialtiesByName(next);
      });

      setPendingDeactivateId((current) =>
        current === savedSpecialty.id ? null : current,
      );
      setBannerError(null);
      setBannerSuccess(
        editingSpecialty
          ? `تم تحديث بيانات تخصص "${savedSpecialty.name}".`
          : `تمت إضافة تخصص "${savedSpecialty.name}".`,
      );
      setDialogOpen(false);
      setEditingSpecialty(null);
      router.refresh();
    } catch {
      setDialogError(CONNECTION_ERROR_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleActive(
    specialty: OwnerSpecialty,
    nextActive: boolean,
  ) {
    if (togglingId || isSubmitting) {
      return;
    }

    setTogglingId(specialty.id);
    setBannerError(null);
    setBannerSuccess(null);

    try {
      const response = await fetch(`/api/owner/specialties/${specialty.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });

      if (!response.ok) {
        const errorBody = await parseJsonSafe<OwnerErrorResponse>(response);
        setBannerError(errorBody?.error ?? CONNECTION_ERROR_MESSAGE);
        return;
      }

      const data = await parseJsonSafe<{ specialty?: OwnerSpecialty }>(
        response,
      );
      if (!data?.specialty) {
        setBannerError(CONNECTION_ERROR_MESSAGE);
        return;
      }

      const updatedSpecialty = data.specialty;
      setSpecialties((current) =>
        sortSpecialtiesByName(
          current.map((item) =>
            item.id === updatedSpecialty.id ? updatedSpecialty : item,
          ),
        ),
      );
      setPendingDeactivateId(null);
      setBannerSuccess(
        updatedSpecialty.isActive
          ? `تم تفعيل تخصص "${updatedSpecialty.name}" وهيظهر للمرضى في صفحة الحجز.`
          : `تم تعطيل تخصص "${updatedSpecialty.name}". الحجوزات القديمة لسه محفوظة زي ما هي.`,
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
    { value: "ALL", label: "الكل", count: specialties.length },
    { value: "ACTIVE", label: "نشط", count: activeCount },
    { value: "INACTIVE", label: "غير نشط", count: inactiveCount },
  ];

  const isFiltered = normalizedQuery.length > 0 || statusFilter !== "ALL";

  return (
    <div className="space-y-6">
      <PageHeader
        title="التخصصات"
        description="إدارة التخصصات الطبية اللي بتظهر للمرضى لما يختاروا الدكتور."
        action={
          <Button
            type="button"
            size="lg"
            onClick={openCreateDialog}
            className="w-full sm:w-auto"
          >
            <Plus className="size-5" aria-hidden="true" />
            إضافة تخصص جديد
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

      {specialties.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between sm:pt-6">
            <div className="relative flex-1">
              <label htmlFor="specialties-search" className="sr-only">
                ابحث باسم التخصص أو الوصف
              </label>
              <Search
                className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="specialties-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="دور باسم التخصص أو الوصف..."
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
              aria-label="فلترة التخصصات حسب الحالة"
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

      {specialties.length === 0 ? (
        <EmptyState
          title="لسه مفيش تخصصات مسجلة"
          description="أضف التخصصات الطبية عشان تربط بيها الدكاترة وتظهر للمرضى."
          action={
            <Button type="button" size="lg" onClick={openCreateDialog}>
              <Plus className="size-5" aria-hidden="true" />
              إضافة تخصص جديد
            </Button>
          }
        />
      ) : filteredSpecialties.length === 0 ? (
        <EmptyState
          title="مفيش تخصصات مطابقة لبحثك"
          description="جرّب تغيّر كلمة البحث أو ترجّع الفلتر لعرض كل التخصصات."
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
                عرض كل التخصصات
              </Button>
            ) : null
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredSpecialties.map((specialty) => {
            const isTogglingThis = togglingId === specialty.id;
            const isConfirmingDeactivate = pendingDeactivateId === specialty.id;

            return (
              <li key={specialty.id} className="flex">
                <Card className="flex w-full flex-col">
                  <CardHeader className="flex-row items-start justify-between gap-3 border-b border-dashed border-border pb-4">
                    <CardTitle className="min-w-0 leading-snug text-foreground">
                      {specialty.name}
                    </CardTitle>
                    <ActiveStatusBadge
                      isActive={specialty.isActive}
                      className="shrink-0"
                    />
                  </CardHeader>

                  <CardContent className="flex-1 space-y-4 pt-4">
                    <dl className="space-y-3 text-sm">
                      <div className="space-y-1">
                        <dt className="flex items-center gap-1.5 font-bold text-muted-foreground">
                          <FileText
                            className="size-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span>وصف التخصص</span>
                        </dt>
                        <dd
                          className={cn(
                            "leading-7",
                            specialty.description
                              ? "font-semibold text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {specialty.description ??
                            "مفيش وصف مضاف للتخصص ده."}
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
                          {formatDoctorCount(specialty.doctorCount)}
                        </dd>
                      </div>
                    </dl>

                    {!specialty.isActive ? (
                      <p className="rounded-md border border-border bg-muted/40 px-3.5 py-2.5 text-xs font-semibold leading-6 text-muted-foreground">
                        التخصص ده متعطّل دلوقتي ومش بيظهر في صفحة الحجز الجديدة،
                        بس الحجوزات القديمة محفوظة.
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
                            onClick={() => handleToggleActive(specialty, false)}
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
                          onClick={() => openEditDialog(specialty)}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                          تعديل البيانات
                        </Button>

                        {specialty.isActive ? (
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={togglingId !== null || isSubmitting}
                            onClick={() =>
                              setPendingDeactivateId(specialty.id)
                            }
                          >
                            <PauseCircle
                              className="size-4"
                              aria-hidden="true"
                            />
                            تعطيل التخصص
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={togglingId !== null || isSubmitting}
                            onClick={() => handleToggleActive(specialty, true)}
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
                                تفعيل التخصص
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
              {editingSpecialty ? "تعديل التخصص" : "إضافة تخصص جديد"}
            </DialogTitle>
            <DialogDescription>
              {editingSpecialty
                ? "عدّل اسم التخصص أو وصفه البسيط للمرضى واضغط حفظ."
                : "اكتب اسم التخصص ووصف مختصر يساعد المريض يفهمه بسرعة."}
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
              label="اسم التخصص"
              htmlFor="specialty-name"
              required
              error={fieldErrors.name}
            >
              <Input
                id="specialty-name"
                type="text"
                value={formState.name}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="مثال: باطنة، أطفال، أسنان"
                maxLength={100}
                required
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.name)}
              />
            </Field>

            <Field
              label="وصف التخصص"
              htmlFor="specialty-description"
              hint="اختياري — اكتب سطر بسيط يشرح التخصص بالعامية للمرضى."
              error={fieldErrors.description}
            >
              <Textarea
                id="specialty-description"
                value={formState.description}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="مثال: متابعة الضغط والسكر وأمراض الجهاز الهضمي"
                maxLength={400}
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.description)}
              />
            </Field>

            <div className="space-y-2 rounded-md border border-border bg-background/60 p-3.5">
              <label
                htmlFor="specialty-is-active"
                className="flex cursor-pointer items-center gap-3 text-sm font-bold text-foreground"
              >
                <input
                  id="specialty-is-active"
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
                <span>التخصص نشط وبيظهر للمرضى</span>
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
                ) : editingSpecialty ? (
                  "حفظ التعديلات"
                ) : (
                  "إضافة التخصص"
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
