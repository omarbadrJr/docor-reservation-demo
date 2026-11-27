"use client";

import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  RotateCcw,
  Stamp,
  UserCheck,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useEffect, useState } from "react";

import { ActiveStatusBadge } from "@/components/dashboard/active-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/state";
import { cn } from "@/lib/utils";
import {
  parseCreateReceptionistInput,
  parseUpdateReceptionistInput,
} from "@/lib/validations/owner";
import type { OwnerErrorResponse, OwnerReceptionist } from "@/types/owner";

export type ClinicOption = {
  id: string;
  name: string;
  isActive: boolean;
};

export interface OwnerReceptionistsManagerProps {
  initialReceptionists: OwnerReceptionist[];
  clinics: ClinicOption[];
}

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

type CreateFormState = {
  name: string;
  email: string;
  password: string;
  clinicId: string;
};

type EditFormState = {
  name: string;
  clinicId: string;
};

const DEFAULT_CONNECTION_ERROR =
  "حصلت مشكلة في الاتصال، تأكد من الإنترنت وحاول تاني.";

function sortReceptionists(items: OwnerReceptionist[]): OwnerReceptionist[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function OwnerReceptionistsManager({
  initialReceptionists,
  clinics,
}: OwnerReceptionistsManagerProps) {
  const router = useRouter();
  const [prevInitialReceptionists, setPrevInitialReceptionists] =
    useState(initialReceptionists);
  const [receptionists, setReceptionists] = useState<OwnerReceptionist[]>(() =>
    sortReceptionists(initialReceptionists),
  );
  if (initialReceptionists !== prevInitialReceptionists) {
    setPrevInitialReceptionists(initialReceptionists);
    setReceptionists(sortReceptionists(initialReceptionists));
  }

  const [clinicFilter, setClinicFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>({
    name: "",
    email: "",
    password: "",
    clinicId: "",
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createFieldErrors, setCreateFieldErrors] = useState<
    Record<string, string>
  >({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [editingTarget, setEditingTarget] = useState<OwnerReceptionist | null>(
    null,
  );
  const [editForm, setEditForm] = useState<EditFormState>({
    name: "",
    clinicId: "",
  });
  const [editFieldErrors, setEditFieldErrors] = useState<
    Record<string, string>
  >({});
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    return () => {
      setIsCreateOpen(false);
      setCreateForm({ name: "", email: "", password: "", clinicId: "" });
      setShowCreatePassword(false);
      setCreateFieldErrors({});
      setCreateError(null);
      setIsCreating(false);
      setEditingTarget(null);
      setEditForm({ name: "", clinicId: "" });
      setEditFieldErrors({});
      setEditError(null);
      setIsEditing(false);
      setTogglingId(null);
      setBannerSuccess(null);
      setBannerError(null);
    };
  }, []);

  const filteredReceptionists = receptionists.filter((item) => {
    if (clinicFilter !== "ALL" && item.clinicId !== clinicFilter) {
      return false;
    }
    if (statusFilter === "ACTIVE" && !item.isActive) {
      return false;
    }
    if (statusFilter === "INACTIVE" && item.isActive) {
      return false;
    }
    return true;
  });

  const hasActiveFilters = clinicFilter !== "ALL" || statusFilter !== "ALL";

  function resetCreateDialogState() {
    setCreateForm({
      name: "",
      email: "",
      password: "",
      clinicId: clinics.length === 1 ? clinics[0].id : "",
    });
    setShowCreatePassword(false);
    setCreateFieldErrors({});
    setCreateError(null);
  }

  function openCreateDialog() {
    setBannerSuccess(null);
    setBannerError(null);
    resetCreateDialogState();
    setIsCreateOpen(true);
  }

  function handleCreateOpenChange(open: boolean) {
    if (!open && isCreating) {
      return;
    }
    setIsCreateOpen(open);
    if (!open) {
      resetCreateDialogState();
    }
  }

  function openEditDialog(target: OwnerReceptionist) {
    setBannerSuccess(null);
    setBannerError(null);
    setEditingTarget(target);
    setEditForm({
      name: target.name,
      clinicId: target.clinicId,
    });
    setEditFieldErrors({});
    setEditError(null);
  }

  function handleEditOpenChange(open: boolean) {
    if (!open && isEditing) {
      return;
    }
    if (!open) {
      setEditingTarget(null);
      setEditFieldErrors({});
      setEditError(null);
    }
  }

  async function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (clinics.length === 0) {
      setCreateError("لازم تضيف عيادة الأول قبل ما تعمل حساب استقبال.");
      return;
    }

    setCreateFieldErrors({});
    setCreateError(null);

    const parsed = parseCreateReceptionistInput({
      name: createForm.name,
      email: createForm.email,
      password: createForm.password,
      clinicId: createForm.clinicId,
    });

    if (!parsed.success) {
      setCreateFieldErrors(parsed.fieldErrors);
      setCreateError(parsed.message);
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/owner/receptionists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        const errorData = await parseJsonSafe<OwnerErrorResponse>(response);
        setCreateFieldErrors(errorData?.fieldErrors ?? {});
        setCreateError(errorData?.error ?? DEFAULT_CONNECTION_ERROR);
        setIsCreating(false);
        return;
      }

      const data = await parseJsonSafe<{ receptionist?: OwnerReceptionist }>(
        response,
      );
      if (!data?.receptionist) {
        setCreateError(DEFAULT_CONNECTION_ERROR);
        setIsCreating(false);
        return;
      }

      const created = data.receptionist;
      setReceptionists((current) => sortReceptionists([...current, created]));
      setIsCreating(false);
      setIsCreateOpen(false);
      resetCreateDialogState();
      setBannerError(null);
      setBannerSuccess(
        `تم إنشاء حساب "${created.name}" وربطه بعيادة "${created.clinicName}".`,
      );
      router.refresh();
    } catch {
      setCreateError(DEFAULT_CONNECTION_ERROR);
      setIsCreating(false);
    }
  }

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTarget) {
      return;
    }

    setEditFieldErrors({});
    setEditError(null);

    const parsed = parseUpdateReceptionistInput({
      name: editForm.name,
      clinicId: editForm.clinicId,
    });

    if (!parsed.success) {
      setEditFieldErrors(parsed.fieldErrors);
      setEditError(parsed.message);
      return;
    }

    setIsEditing(true);
    try {
      const response = await fetch(
        `/api/owner/receptionists/${editingTarget.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );

      if (!response.ok) {
        const errorData = await parseJsonSafe<OwnerErrorResponse>(response);
        setEditFieldErrors(errorData?.fieldErrors ?? {});
        setEditError(errorData?.error ?? DEFAULT_CONNECTION_ERROR);
        setIsEditing(false);
        return;
      }

      const data = await parseJsonSafe<{ receptionist?: OwnerReceptionist }>(
        response,
      );
      if (!data?.receptionist) {
        setEditError(DEFAULT_CONNECTION_ERROR);
        setIsEditing(false);
        return;
      }

      const updated = data.receptionist;
      setReceptionists((current) =>
        sortReceptionists(
          current.map((item) => (item.id === updated.id ? updated : item)),
        ),
      );
      setIsEditing(false);
      setEditingTarget(null);
      setBannerError(null);
      setBannerSuccess(`تم تعديل بيانات "${updated.name}" بنجاح.`);
      router.refresh();
    } catch {
      setEditError(DEFAULT_CONNECTION_ERROR);
      setIsEditing(false);
    }
  }

  async function handleToggleActive(target: OwnerReceptionist) {
    if (togglingId || isCreating || isEditing) {
      return;
    }

    setBannerSuccess(null);
    setBannerError(null);
    setTogglingId(target.id);

    const nextActive = !target.isActive;
    try {
      const response = await fetch(`/api/owner/receptionists/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });

      if (!response.ok) {
        const errorData = await parseJsonSafe<OwnerErrorResponse>(response);
        setBannerError(errorData?.error ?? DEFAULT_CONNECTION_ERROR);
        setTogglingId(null);
        return;
      }

      const data = await parseJsonSafe<{ receptionist?: OwnerReceptionist }>(
        response,
      );
      if (!data?.receptionist) {
        setBannerError(DEFAULT_CONNECTION_ERROR);
        setTogglingId(null);
        return;
      }

      const updated = data.receptionist;
      setReceptionists((current) =>
        sortReceptionists(
          current.map((item) => (item.id === updated.id ? updated : item)),
        ),
      );
      setTogglingId(null);
      setBannerSuccess(
        updated.isActive
          ? `تم تفعيل حساب "${updated.name}".`
          : `تم تعطيل حساب "${updated.name}".`,
      );
      router.refresh();
    } catch {
      setBannerError(DEFAULT_CONNECTION_ERROR);
      setTogglingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="موظفي الاستقبال"
        description="أضف حسابات موظفي الاستقبال واربط كل موظف بعيادته أو عدّل بياناته."
        action={
          <Button type="button" size="lg" onClick={openCreateDialog}>
            <UserPlus className="size-5" aria-hidden="true" />
            إضافة موظف استقبال جديد
          </Button>
        }
      />

      {bannerSuccess ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm leading-6 font-semibold text-foreground"
        >
          <Stamp
            className="mt-0.5 size-5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <p>{bannerSuccess}</p>
        </div>
      ) : null}

      {bannerError ? (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 font-semibold text-destructive"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{bannerError}</p>
        </div>
      ) : null}

      <section
        aria-label="تصفية حسابات موظفي الاستقبال"
        className="rounded-md border border-border bg-card p-4 sm:p-5"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="receptionists-clinic-filter">
                تصفية حسب العيادة
              </Label>
              <Select
                id="receptionists-clinic-filter"
                value={clinicFilter}
                onChange={(event) => setClinicFilter(event.target.value)}
              >
                <option value="ALL">كل العيادات</option>
                {clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.isActive
                      ? clinic.name
                      : `${clinic.name} (عيادة غير نشطة)`}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <span className="flex items-center gap-1 text-sm leading-none font-bold text-foreground">
                حالة الحساب
              </span>
              <div
                role="group"
                aria-label="تصفية حسب الحالة"
                className="flex flex-wrap gap-2"
              >
                {(
                  [
                    { value: "ALL", label: "الكل" },
                    { value: "ACTIVE", label: "نشط" },
                    { value: "INACTIVE", label: "غير نشط" },
                  ] as const
                ).map((option) => {
                  const selected = statusFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setStatusFilter(option.value)}
                      className={cn(
                        "inline-flex min-h-11 items-center justify-center rounded-md border px-4 text-sm font-semibold transition-colors",
                        selected
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-card text-foreground hover:bg-muted",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="text-sm font-semibold text-muted-foreground tabular-nums">
            معروض {filteredReceptionists.length} من {receptionists.length} حساب
          </p>
        </div>
      </section>

      {receptionists.length === 0 ? (
        <EmptyState
          title="لسه مفيش حسابات لموظفي استقبال"
          description="ابدأ بإضافة أول حساب لموظف استقبال عشان يقدر يتابع حجوزات عيادته ويسجل وصول المرضى."
          action={
            <Button type="button" size="lg" onClick={openCreateDialog}>
              <UserPlus className="size-5" aria-hidden="true" />
              إضافة موظف استقبال جديد
            </Button>
          }
        />
      ) : filteredReceptionists.length === 0 ? (
        <EmptyState
          title="مفيش حسابات مطابقة للتصفية"
          description="جرّب تغيّر العيادة أو حالة الحساب عشان تشوف باقي موظفي الاستقبال."
          action={
            hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setClinicFilter("ALL");
                  setStatusFilter("ALL");
                }}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                عرض كل الحسابات
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredReceptionists.map((item) => {
            const isToggling = togglingId === item.id;
            return (
              <Card key={item.id} className="flex flex-col justify-between">
                <div>
                  <CardHeader className="flex-row items-start justify-between gap-3">
                    <CardTitle className="min-w-0 break-words">
                      {item.name}
                    </CardTitle>
                    <ActiveStatusBadge isActive={item.isActive} />
                  </CardHeader>

                  <CardContent>
                    <dl className="space-y-3 border-t border-dashed border-border pt-4 text-sm">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <dt className="shrink-0 font-bold text-muted-foreground">
                          البريد الإلكتروني
                        </dt>
                        <dd
                          dir="ltr"
                          className="text-left font-semibold break-all text-foreground"
                        >
                          {item.email}
                        </dd>
                      </div>

                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <dt className="shrink-0 font-bold text-muted-foreground">
                          العيادة
                        </dt>
                        <dd className="font-semibold text-foreground">
                          {item.clinicName}
                          {!item.clinicIsActive ? (
                            <span className="mr-1.5 inline-block text-xs font-bold text-destructive">
                              (عيادة غير نشطة)
                            </span>
                          ) : null}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </div>

                <CardFooter className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={togglingId !== null}
                    onClick={() => openEditDialog(item)}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    تعديل البيانات
                  </Button>

                  <Button
                    type="button"
                    variant={item.isActive ? "destructive" : "secondary"}
                    disabled={togglingId !== null}
                    onClick={() => handleToggleActive(item)}
                  >
                    {isToggling ? (
                      <>
                        <Loader2
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                        {item.isActive ? "بنعطل الحساب..." : "بنفعّل الحساب..."}
                      </>
                    ) : item.isActive ? (
                      <>
                        <UserMinus className="size-4" aria-hidden="true" />
                        تعطيل الحساب
                      </>
                    ) : (
                      <>
                        <UserCheck className="size-4" aria-hidden="true" />
                        تفعيل الحساب
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={handleCreateOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة موظف استقبال جديد</DialogTitle>
            <DialogDescription>
              اعمل حساب لموظف الاستقبال وحدد له العيادة اللي هيدير حجوزاتها.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleCreateSubmit}
            noValidate
            className="mt-5 space-y-4"
          >
            {clinics.length === 0 ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 font-semibold text-destructive"
              >
                <AlertCircle
                  className="mt-0.5 size-5 shrink-0"
                  aria-hidden="true"
                />
                <p>لازم تضيف عيادة واحدة على الأقل قبل إنشاء حساب استقبال.</p>
              </div>
            ) : null}

            {createError ? (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 font-semibold text-destructive"
              >
                <AlertCircle
                  className="mt-0.5 size-5 shrink-0"
                  aria-hidden="true"
                />
                <p>{createError}</p>
              </div>
            ) : null}

            <Field
              label="اسم الموظف"
              htmlFor="create-receptionist-name"
              required
              error={createFieldErrors.name}
            >
              <Input
                id="create-receptionist-name"
                type="text"
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="مثال: منى إبراهيم"
                required
                disabled={isCreating}
                aria-invalid={Boolean(createFieldErrors.name)}
              />
            </Field>

            <Field
              label="البريد الإلكتروني"
              htmlFor="create-receptionist-email"
              required
              error={createFieldErrors.email}
            >
              <Input
                id="create-receptionist-email"
                type="email"
                inputMode="email"
                dir="ltr"
                autoComplete="off"
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="reception@example.com"
                required
                disabled={isCreating}
                aria-invalid={Boolean(createFieldErrors.email)}
                className="text-left"
              />
            </Field>

            <Field
              label="كلمة المرور"
              htmlFor="create-receptionist-password"
              required
              hint="8 حروف أو أرقام على الأقل. سلّمها للموظف دلوقتي عشان مش هتظهر تاني بعد الإنشاء."
              error={createFieldErrors.password}
            >
              <div className="relative" dir="ltr">
                <Input
                  id="create-receptionist-password"
                  type={showCreatePassword ? "text" : "password"}
                  dir="ltr"
                  autoComplete="new-password"
                  minLength={8}
                  value={createForm.password}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder="••••••••"
                  required
                  disabled={isCreating}
                  aria-invalid={Boolean(createFieldErrors.password)}
                  className="pr-13 text-left"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword((current) => !current)}
                  disabled={isCreating}
                  aria-label={
                    showCreatePassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                  }
                  aria-pressed={showCreatePassword}
                  className="absolute top-1/2 right-1 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                >
                  {showCreatePassword ? (
                    <EyeOff className="size-5" aria-hidden="true" />
                  ) : (
                    <Eye className="size-5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </Field>

            <Field
              label="العيادة"
              htmlFor="create-receptionist-clinic"
              required
              error={createFieldErrors.clinicId}
            >
              <Select
                id="create-receptionist-clinic"
                value={createForm.clinicId}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    clinicId: event.target.value,
                  }))
                }
                required
                disabled={isCreating || clinics.length === 0}
                aria-invalid={Boolean(createFieldErrors.clinicId)}
              >
                <option value="">اختار العيادة</option>
                {clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.isActive
                      ? clinic.name
                      : `${clinic.name} (عيادة غير نشطة)`}
                  </option>
                ))}
              </Select>
            </Field>

            <DialogFooter>
              <Button
                type="submit"
                size="lg"
                disabled={isCreating || clinics.length === 0}
              >
                {isCreating ? (
                  <>
                    <Loader2
                      className="size-5 animate-spin"
                      aria-hidden="true"
                    />
                    بنعمل الحساب...
                  </>
                ) : (
                  "إنشاء الحساب"
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isCreating}
                onClick={() => handleCreateOpenChange(false)}
              >
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editingTarget !== null} onOpenChange={handleEditOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل بيانات موظف الاستقبال</DialogTitle>
            <DialogDescription>
              تقدر تعدّل اسم الموظف أو العيادة المربوط بيها. البريد الإلكتروني
              وكلمة المرور بيتحددوا وقت الإنشاء بس.
            </DialogDescription>
          </DialogHeader>

          {editingTarget ? (
            <form
              onSubmit={handleEditSubmit}
              noValidate
              className="mt-5 space-y-4"
            >
              {editError ? (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 font-semibold text-destructive"
                >
                  <AlertCircle
                    className="mt-0.5 size-5 shrink-0"
                    aria-hidden="true"
                  />
                  <p>{editError}</p>
                </div>
              ) : null}

              <div className="space-y-1 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
                <p className="font-bold text-muted-foreground">
                  البريد الإلكتروني
                </p>
                <p
                  dir="ltr"
                  className="text-left font-semibold break-all text-foreground"
                >
                  {editingTarget.email}
                </p>
              </div>

              <Field
                label="اسم الموظف"
                htmlFor="edit-receptionist-name"
                required
                error={editFieldErrors.name}
              >
                <Input
                  id="edit-receptionist-name"
                  type="text"
                  value={editForm.name}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                  disabled={isEditing}
                  aria-invalid={Boolean(editFieldErrors.name)}
                />
              </Field>

              <Field
                label="العيادة"
                htmlFor="edit-receptionist-clinic"
                required
                error={editFieldErrors.clinicId}
              >
                <Select
                  id="edit-receptionist-clinic"
                  value={editForm.clinicId}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      clinicId: event.target.value,
                    }))
                  }
                  required
                  disabled={isEditing || clinics.length === 0}
                  aria-invalid={Boolean(editFieldErrors.clinicId)}
                >
                  <option value="">اختار العيادة</option>
                  {clinics.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.isActive
                        ? clinic.name
                        : `${clinic.name} (عيادة غير نشطة)`}
                    </option>
                  ))}
                </Select>
              </Field>

              <DialogFooter>
                <Button type="submit" size="lg" disabled={isEditing}>
                  {isEditing ? (
                    <>
                      <Loader2
                        className="size-5 animate-spin"
                        aria-hidden="true"
                      />
                      بنحفظ التعديلات...
                    </>
                  ) : (
                    "حفظ التعديلات"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={isEditing}
                  onClick={() => handleEditOpenChange(false)}
                >
                  إلغاء
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
