"use client";

import {
  AlertCircle,
  CalendarClock,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Search,
  Stamp,
  Trash2,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { ActiveStatusBadge } from "@/components/dashboard/active-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { formatConsultationFee, formatExperienceYears } from "@/lib/format";
import { cn } from "@/lib/utils";
import { parseCreateDoctorInput } from "@/lib/validations/owner";
import type { OwnerDoctorFormOptions } from "@/services/owner-doctors";
import type { OwnerDoctor, OwnerErrorResponse } from "@/types/owner";

const SLOT_DURATION_PRESETS = [15, 20, 30, 45, 60] as const;

const DEFAULT_SAVE_ERROR = "مقدرناش نحفظ بيانات الدكتور دلوقتي، حاول تاني.";
const DEFAULT_TOGGLE_ERROR = "مقدرناش نغيّر حالة الدكتور دلوقتي، حاول تاني.";
const DEFAULT_UPLOAD_ERROR = "مقدرناش نرفع صورة الدكتور دلوقتي، حاول تاني.";

type StatusFilter = "all" | "active" | "inactive";

interface DoctorFormState {
  fullName: string;
  clinicId: string;
  specialtyId: string;
  consultationFee: string;
  slotDurationMinutes: string;
  experienceYears: string;
  qualifications: string;
  bio: string;
  photoUrl: string;
  isActive: boolean;
}

type NoticeBanner = {
  tone: "success" | "error";
  message: string;
};

export interface OwnerDoctorsManagerProps {
  initialDoctors: OwnerDoctor[];
  options: OwnerDoctorFormOptions;
}

function getInitialCharacter(fullName: string): string | null {
  const cleaned = fullName
    .trim()
    .replace(/^(?:دكتورة|دكتور|د\.|د\/)\s*/u, "")
    .trim();

  if (!cleaned) {
    return null;
  }

  return Array.from(cleaned)[0] ?? null;
}

function formatFeeInputValue(fee: string): string {
  const trimmed = fee.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/\.00$/, "");
}

function sortDoctorsByName(doctors: OwnerDoctor[]): OwnerDoctor[] {
  return [...doctors].sort((a, b) => a.fullName.localeCompare(b.fullName, "ar"));
}

function buildEmptyFormState(options: OwnerDoctorFormOptions): DoctorFormState {
  const preferredClinic =
    options.clinics.find((item) => item.isActive) ?? options.clinics[0];
  const preferredSpecialty =
    options.specialties.find((item) => item.isActive) ?? options.specialties[0];

  return {
    fullName: "",
    clinicId: preferredClinic?.id ?? "",
    specialtyId: preferredSpecialty?.id ?? "",
    consultationFee: "",
    slotDurationMinutes: "30",
    experienceYears: "",
    qualifications: "",
    bio: "",
    photoUrl: "",
    isActive: true,
  };
}

function buildEditFormState(doctor: OwnerDoctor): DoctorFormState {
  return {
    fullName: doctor.fullName,
    clinicId: doctor.clinicId,
    specialtyId: doctor.specialtyId,
    consultationFee: formatFeeInputValue(doctor.consultationFee),
    slotDurationMinutes: String(doctor.slotDurationMinutes),
    experienceYears:
      doctor.experienceYears === null ? "" : String(doctor.experienceYears),
    qualifications: doctor.qualifications ?? "",
    bio: doctor.bio ?? "",
    photoUrl: doctor.photoUrl ?? "",
    isActive: doctor.isActive,
  };
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function DoctorAvatar({
  photoUrl,
  fullName,
  className = "size-20",
}: {
  photoUrl: string | null;
  fullName: string;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initial = getInitialCharacter(fullName);
  const showImage = Boolean(photoUrl && failedUrl !== photoUrl);

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md border border-border bg-secondary",
        className,
      )}
    >
      {showImage && photoUrl ? (
        <Image
          src={photoUrl}
          alt={`صورة ${fullName}`}
          fill
          unoptimized
          sizes="80px"
          className="object-cover"
          onError={() => setFailedUrl(photoUrl)}
        />
      ) : (
        <span className="flex size-full items-center justify-center font-heading text-2xl font-extrabold text-foreground">
          {initial ?? <UserRound className="size-8 text-muted-foreground" aria-hidden="true" />}
          <span className="sr-only">صورة غير متاحة لـ {fullName}</span>
        </span>
      )}
    </div>
  );
}

export function OwnerDoctorsManager({
  initialDoctors,
  options,
}: OwnerDoctorsManagerProps) {
  const router = useRouter();
  const [prevInitialDoctors, setPrevInitialDoctors] = useState(initialDoctors);
  const [doctors, setDoctors] = useState<OwnerDoctor[]>(() =>
    sortDoctorsByName(initialDoctors),
  );
  if (initialDoctors !== prevInitialDoctors) {
    setPrevInitialDoctors(initialDoctors);
    setDoctors(sortDoctorsByName(initialDoctors));
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [clinicFilter, setClinicFilter] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [notice, setNotice] = useState<NoticeBanner | null>(null);
  const [togglingDoctorId, setTogglingDoctorId] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<OwnerDoctor | null>(null);
  const [formValues, setFormValues] = useState<DoctorFormState>(() =>
    buildEmptyFormState(options),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fileInput = fileInputRef.current;
    return () => {
      setIsDialogOpen(false);
      setEditingDoctor(null);
      setFieldErrors({});
      setFormError(null);
      setPhotoError(null);
      setIsSubmitting(false);
      setIsUploadingPhoto(false);
      setTogglingDoctorId(null);
      setNotice(null);
      if (fileInput) {
        fileInput.value = "";
      }
    };
  }, []);
  const searchInputId = useId();
  const clinicFilterId = useId();
  const specialtyFilterId = useId();
  const statusFilterId = useId();

  const fullNameInputId = useId();
  const clinicSelectId = useId();
  const specialtySelectId = useId();
  const feeInputId = useId();
  const slotInputId = useId();
  const experienceInputId = useId();
  const qualificationsInputId = useId();
  const bioInputId = useId();
  const isActiveInputId = useId();
  const photoInputId = useId();

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    clinicFilter.length > 0 ||
    specialtyFilter.length > 0 ||
    statusFilter !== "all";

  const filteredDoctors = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return doctors.filter((doctor) => {
      if (
        normalizedQuery.length > 0 &&
        !doctor.fullName.toLowerCase().includes(normalizedQuery)
      ) {
        return false;
      }

      if (clinicFilter && doctor.clinicId !== clinicFilter) {
        return false;
      }

      if (specialtyFilter && doctor.specialtyId !== specialtyFilter) {
        return false;
      }

      if (statusFilter === "active" && !doctor.isActive) {
        return false;
      }

      if (statusFilter === "inactive" && doctor.isActive) {
        return false;
      }

      return true;
    });
  }, [doctors, searchQuery, clinicFilter, specialtyFilter, statusFilter]);

  const missingDependencies =
    options.clinics.length === 0 || options.specialties.length === 0;

  function resetFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function clearFilters() {
    setSearchQuery("");
    setClinicFilter("");
    setSpecialtyFilter("");
    setStatusFilter("all");
  }

  function openCreateDialog() {
    setEditingDoctor(null);
    setFormValues(buildEmptyFormState(options));
    setFieldErrors({});
    setFormError(null);
    setPhotoError(null);
    resetFileInput();
    setIsDialogOpen(true);
  }

  function openEditDialog(doctor: OwnerDoctor) {
    setEditingDoctor(doctor);
    setFormValues(buildEditFormState(doctor));
    setFieldErrors({});
    setFormError(null);
    setPhotoError(null);
    resetFileInput();
    setIsDialogOpen(true);
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (isSubmitting || isUploadingPhoto) {
      return;
    }
    setIsDialogOpen(nextOpen);
    if (!nextOpen) {
      setFormError(null);
      setFieldErrors({});
      setPhotoError(null);
      resetFileInput();
    }
  }

  function updateField<K extends keyof DoctorFormState>(
    key: K,
    value: DoctorFormState[K],
  ) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!(key in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (formError) {
      setFormError(null);
    }
  }

  async function handlePhotoFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploadingPhoto(true);
    setPhotoError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/owner/doctors/photo", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await parseJsonSafe<OwnerErrorResponse>(response);
        setPhotoError(
          errorData?.fieldErrors?.file ??
            errorData?.error ??
            DEFAULT_UPLOAD_ERROR,
        );
        return;
      }

      const payload = await parseJsonSafe<{ photoUrl: string }>(response);
      if (!payload?.photoUrl) {
        setPhotoError(DEFAULT_UPLOAD_ERROR);
        return;
      }

      updateField("photoUrl", payload.photoUrl);
    } catch {
      setPhotoError(DEFAULT_UPLOAD_ERROR);
    } finally {
      setIsUploadingPhoto(false);
      resetFileInput();
    }
  }

  function handleRemovePhoto() {
    updateField("photoUrl", "");
    setPhotoError(null);
    resetFileInput();
  }

  async function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || isUploadingPhoto) {
      return;
    }

    const candidatePayload = {
      fullName: formValues.fullName,
      clinicId: formValues.clinicId,
      specialtyId: formValues.specialtyId,
      consultationFee: formValues.consultationFee,
      slotDurationMinutes: formValues.slotDurationMinutes,
      experienceYears: formValues.experienceYears,
      qualifications: formValues.qualifications,
      bio: formValues.bio,
      photoUrl: formValues.photoUrl.trim() ? formValues.photoUrl.trim() : null,
      isActive: formValues.isActive,
    };

    const parsed = parseCreateDoctorInput(candidatePayload);
    if (!parsed.success) {
      setFieldErrors(parsed.fieldErrors);
      setFormError(parsed.message);
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    try {
      const targetUrl = editingDoctor
        ? `/api/owner/doctors/${encodeURIComponent(editingDoctor.id)}`
        : "/api/owner/doctors";
      const method = editingDoctor ? "PATCH" : "POST";

      const response = await fetch(targetUrl, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        const errorData = await parseJsonSafe<OwnerErrorResponse>(response);
        if (errorData?.fieldErrors) {
          setFieldErrors(errorData.fieldErrors);
        }
        setFormError(errorData?.error ?? DEFAULT_SAVE_ERROR);
        return;
      }

      const payload = await parseJsonSafe<{ doctor: OwnerDoctor }>(response);
      if (!payload?.doctor) {
        setFormError(DEFAULT_SAVE_ERROR);
        return;
      }

      const savedDoctor = payload.doctor;
      setDoctors((prev) => {
        const exists = prev.some((item) => item.id === savedDoctor.id);
        const updated = exists
          ? prev.map((item) => (item.id === savedDoctor.id ? savedDoctor : item))
          : [...prev, savedDoctor];
        return sortDoctorsByName(updated);
      });

      setNotice({
        tone: "success",
        message: editingDoctor
          ? `تم تحديث بيانات ${savedDoctor.fullName} بنجاح.`
          : `تمت إضافة ${savedDoctor.fullName} بنجاح. تقدر تضبط مواعيده من زرار "المواعيد والجدول".`,
      });
      setIsDialogOpen(false);
      setEditingDoctor(null);
      router.refresh();
    } catch {
      setFormError(DEFAULT_SAVE_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleActive(doctor: OwnerDoctor) {
    if (togglingDoctorId) {
      return;
    }

    const nextActive = !doctor.isActive;
    setTogglingDoctorId(doctor.id);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/owner/doctors/${encodeURIComponent(doctor.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isActive: nextActive }),
        },
      );

      if (!response.ok) {
        const errorData = await parseJsonSafe<OwnerErrorResponse>(response);
        setNotice({
          tone: "error",
          message: errorData?.error ?? DEFAULT_TOGGLE_ERROR,
        });
        return;
      }

      const payload = await parseJsonSafe<{ doctor: OwnerDoctor }>(response);
      if (!payload?.doctor) {
        setNotice({
          tone: "error",
          message: DEFAULT_TOGGLE_ERROR,
        });
        return;
      }

      const updatedDoctor = payload.doctor;
      setDoctors((prev) =>
        sortDoctorsByName(
          prev.map((item) =>
            item.id === updatedDoctor.id ? updatedDoctor : item,
          ),
        ),
      );

      setNotice({
        tone: "success",
        message: nextActive
          ? `تم تفعيل ${updatedDoctor.fullName} وهيظهر للمرضى تاني.`
          : `تم تعطيل ${updatedDoctor.fullName}. الحجوزات الجديدة اتوقفت، والحجوزات السابقة لسه موجودة في المتابعة.`,
      });
      router.refresh();
    } catch {
      setNotice({
        tone: "error",
        message: DEFAULT_TOGGLE_ERROR,
      });
    } finally {
      setTogglingDoctorId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="الدكاترة"
        description="إضافة الدكاترة وربط كل دكتور بعيادة وتخصص واحد وتحديد سعر ومدة الكشف."
        action={
          <Button type="button" onClick={openCreateDialog}>
            <Plus className="size-5" aria-hidden="true" />
            إضافة دكتور جديد
          </Button>
        }
      />

      {notice ? (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          aria-live={notice.tone === "error" ? "assertive" : "polite"}
          className={cn(
            "flex items-start gap-2.5 rounded-md border px-4 py-3 text-sm leading-6 font-semibold",
            notice.tone === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-primary/30 bg-card text-foreground",
          )}
        >
          {notice.tone === "error" ? (
            <AlertCircle
              className="mt-0.5 size-5 shrink-0 text-destructive"
              aria-hidden="true"
            />
          ) : (
            <Stamp
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
          )}
          <p>{notice.message}</p>
        </div>
      ) : null}

      <section
        aria-label="تصفية الدكاترة"
        className="rounded-md border border-border bg-card p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor={searchInputId}>بحث باسم الدكتور</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id={searchInputId}
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="اكتب اسم الدكتور..."
                className="pr-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={clinicFilterId}>العيادة</Label>
            <Select
              id={clinicFilterId}
              value={clinicFilter}
              onChange={(event) => setClinicFilter(event.target.value)}
            >
              <option value="">كل العيادات</option>
              {options.clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.isActive
                    ? clinic.name
                    : `${clinic.name} (غير نشطة)`}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={specialtyFilterId}>التخصص</Label>
            <Select
              id={specialtyFilterId}
              value={specialtyFilter}
              onChange={(event) => setSpecialtyFilter(event.target.value)}
            >
              <option value="">كل التخصصات</option>
              {options.specialties.map((specialty) => (
                <option key={specialty.id} value={specialty.id}>
                  {specialty.isActive
                    ? specialty.name
                    : `${specialty.name} (غير نشط)`}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={statusFilterId}>الحالة</Label>
            <Select
              id={statusFilterId}
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
            >
              <option value="all">الكل</option>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </Select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-border pt-4 text-sm text-muted-foreground">
          <p className="tabular-nums">
            ظاهر <strong className="text-foreground">{filteredDoctors.length}</strong> من
            أصل <strong className="text-foreground">{doctors.length}</strong> دكتور
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <span>
              تعطيل أي دكتور بيوقف الحجوزات الجديدة مع الحفاظ على المواعيد
              السابقة.
            </span>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearFilters}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                مسح الفلاتر
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {doctors.length === 0 ? (
        <EmptyState
          title="مفيش دكاترة متسجلين لسه"
          description="ابدأ بإضافة أول دكتور واربطه بالعيادة والتخصص المناسبين."
          action={
            <Button type="button" onClick={openCreateDialog}>
              <Plus className="size-5" aria-hidden="true" />
              إضافة دكتور جديد
            </Button>
          }
        />
      ) : filteredDoctors.length === 0 ? (
        <EmptyState
          title="مفيش دكتور مطابق للبحث ده"
          description="جرّب تغيّر اسم البحث أو التصفية بالعيادة والتخصص والحالة."
          action={
            <Button type="button" variant="outline" onClick={clearFilters}>
              <RotateCcw className="size-4" aria-hidden="true" />
              مسح الفلاتر
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filteredDoctors.map((doctor) => {
            const experienceLabel = formatExperienceYears(
              doctor.experienceYears,
            );
            const isToggling = togglingDoctorId === doctor.id;

            return (
              <Card
                key={doctor.id}
                className="flex h-full flex-col justify-between"
              >
                <div>
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <DoctorAvatar
                        photoUrl={doctor.photoUrl}
                        fullName={doctor.fullName}
                        className="size-20"
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <CardTitle className="text-xl">
                            {doctor.fullName}
                          </CardTitle>
                          <ActiveStatusBadge isActive={doctor.isActive} />
                        </div>

                        <div className="space-y-1 text-sm">
                          <p className="font-bold text-primary">
                            {doctor.specialtyName}
                            {!doctor.specialtyIsActive ? (
                              <span className="mr-1.5 font-semibold text-destructive">
                                (تخصص غير نشط)
                              </span>
                            ) : null}
                          </p>
                          <p className="text-muted-foreground">
                            {doctor.clinicName}
                            {!doctor.clinicIsActive ? (
                              <span className="mr-1.5 font-semibold text-destructive">
                                (عيادة غير نشطة)
                              </span>
                            ) : null}
                          </p>
                        </div>

                        {!doctor.isActive ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            الحجوزات الجديدة موقوفة والحجوزات السابقة لسه ظاهرة
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {doctor.qualifications || doctor.bio ? (
                      <div className="space-y-1.5 text-sm leading-6 text-muted-foreground">
                        {doctor.qualifications ? (
                          <p className="line-clamp-1 font-semibold text-foreground">
                            {doctor.qualifications}
                          </p>
                        ) : null}
                        {doctor.bio ? (
                          <p className="line-clamp-2">{doctor.bio}</p>
                        ) : null}
                      </div>
                    ) : null}

                    <div
                      className="border-t border-dashed border-border"
                      aria-hidden="true"
                    />

                    <dl className="grid gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="font-bold text-foreground">سعر الكشف</dt>
                        <dd className="mt-1 tabular-nums text-muted-foreground">
                          {formatConsultationFee(doctor.consultationFee)}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-bold text-foreground">مدة الكشف</dt>
                        <dd className="mt-1 tabular-nums text-muted-foreground">
                          {doctor.slotDurationMinutes} دقيقة
                        </dd>
                      </div>
                      <div>
                        <dt className="font-bold text-foreground">سنين الخبرة</dt>
                        <dd className="mt-1 tabular-nums text-muted-foreground">
                          {experienceLabel ?? "غير محددة"}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </div>

                <CardFooter className="flex-wrap justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/owner/doctors/${encodeURIComponent(doctor.id)}/schedule`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "default" }),
                      )}
                    >
                      <CalendarClock className="size-4" aria-hidden="true" />
                      المواعيد والجدول
                    </Link>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openEditDialog(doctor)}
                      disabled={togglingDoctorId !== null}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      تعديل البيانات
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant={doctor.isActive ? "destructive" : "secondary"}
                    onClick={() => handleToggleActive(doctor)}
                    disabled={togglingDoctorId !== null}
                  >
                    {isToggling ? (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Power className="size-4" aria-hidden="true" />
                    )}
                    {doctor.isActive ? "تعطيل" : "تفعيل"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingDoctor ? "تعديل بيانات الدكتور" : "إضافة دكتور جديد"}
            </DialogTitle>
            <DialogDescription>
              {editingDoctor
                ? "حدّث بيانات الدكتور والعيادة والتخصص أو الصورة، والتعديل هيسمع فوراً."
                : "اكتب بيانات الدكتور واربطه بعيادة وتخصص واحد."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} noValidate className="mt-5 space-y-5">
            {missingDependencies ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 font-semibold text-destructive"
              >
                <AlertCircle
                  className="mt-0.5 size-5 shrink-0"
                  aria-hidden="true"
                />
                <p>
                  لازم يكون فيه عيادة واحدة وتخصص واحد على الأقل قبل ما تضيف
                  دكتور جديد.
                </p>
              </div>
            ) : null}

            {formError ? (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 font-semibold text-destructive"
              >
                <AlertCircle
                  className="mt-0.5 size-5 shrink-0"
                  aria-hidden="true"
                />
                <p>{formError}</p>
              </div>
            ) : null}

            <div className="rounded-md border border-border bg-background p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <DoctorAvatar
                  photoUrl={formValues.photoUrl.trim() || null}
                  fullName={formValues.fullName || "دكتور"}
                  className="size-20"
                />

                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor={photoInputId}>صورة الدكتور (اختياري)</Label>
                  <input
                    ref={fileInputRef}
                    id={photoInputId}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoFileChange}
                    disabled={isUploadingPhoto || isSubmitting}
                    className="sr-only"
                  />

                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingPhoto || isSubmitting}
                    >
                      {isUploadingPhoto ? (
                        <>
                          <Loader2
                            className="size-4 animate-spin"
                            aria-hidden="true"
                          />
                          جاري رفع الصورة...
                        </>
                      ) : (
                        <>
                          <ImagePlus className="size-4" aria-hidden="true" />
                          {formValues.photoUrl ? "تغيير الصورة" : "رفع صورة"}
                        </>
                      )}
                    </Button>

                    {formValues.photoUrl ? (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleRemovePhoto}
                        disabled={isUploadingPhoto || isSubmitting}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        حذف الصورة
                      </Button>
                    ) : null}
                  </div>

                  <p className="text-xs leading-5 text-muted-foreground">
                    JPG أو PNG أو WebP بحد أقصى 5 ميجا.
                  </p>

                  {photoError ? (
                    <p
                      role="alert"
                      className="text-sm font-semibold text-destructive"
                    >
                      {photoError}
                    </p>
                  ) : null}

                  {fieldErrors.photoUrl ? (
                    <p
                      role="alert"
                      className="text-sm font-semibold text-destructive"
                    >
                      {fieldErrors.photoUrl}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <Field
              label="اسم الدكتور بالكامل"
              htmlFor={fullNameInputId}
              required
              error={fieldErrors.fullName}
            >
              <Input
                id={fullNameInputId}
                type="text"
                value={formValues.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
                placeholder="مثال: د. أحمد مصطفى"
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.fullName)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="العيادة"
                htmlFor={clinicSelectId}
                required
                error={fieldErrors.clinicId}
              >
                <Select
                  id={clinicSelectId}
                  value={formValues.clinicId}
                  onChange={(event) =>
                    updateField("clinicId", event.target.value)
                  }
                  disabled={isSubmitting || options.clinics.length === 0}
                  aria-invalid={Boolean(fieldErrors.clinicId)}
                >
                  <option value="">اختار العيادة</option>
                  {options.clinics.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>
                      {clinic.isActive
                        ? clinic.name
                        : `${clinic.name} (غير نشطة)`}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="التخصص الأساسي"
                htmlFor={specialtySelectId}
                required
                error={fieldErrors.specialtyId}
              >
                <Select
                  id={specialtySelectId}
                  value={formValues.specialtyId}
                  onChange={(event) =>
                    updateField("specialtyId", event.target.value)
                  }
                  disabled={isSubmitting || options.specialties.length === 0}
                  aria-invalid={Boolean(fieldErrors.specialtyId)}
                >
                  <option value="">اختار التخصص</option>
                  {options.specialties.map((specialty) => (
                    <option key={specialty.id} value={specialty.id}>
                      {specialty.isActive
                        ? specialty.name
                        : `${specialty.name} (غير نشط)`}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="سعر الكشف (بالجنيه)"
                htmlFor={feeInputId}
                required
                error={fieldErrors.consultationFee}
              >
                <Input
                  id={feeInputId}
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={formValues.consultationFee}
                  onChange={(event) =>
                    updateField("consultationFee", event.target.value)
                  }
                  placeholder="250"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldErrors.consultationFee)}
                  className="text-left tabular-nums"
                />
              </Field>

              <Field
                label="مدة الكشف (بالدقيقة)"
                htmlFor={slotInputId}
                required
                error={fieldErrors.slotDurationMinutes}
              >
                <Input
                  id={slotInputId}
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  dir="ltr"
                  value={formValues.slotDurationMinutes}
                  onChange={(event) =>
                    updateField("slotDurationMinutes", event.target.value)
                  }
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldErrors.slotDurationMinutes)}
                  className="text-left tabular-nums"
                />
              </Field>

              <Field
                label="سنين الخبرة (اختياري)"
                htmlFor={experienceInputId}
                error={fieldErrors.experienceYears}
              >
                <Input
                  id={experienceInputId}
                  type="number"
                  min={0}
                  max={70}
                  dir="ltr"
                  value={formValues.experienceYears}
                  onChange={(event) =>
                    updateField("experienceYears", event.target.value)
                  }
                  placeholder="10"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldErrors.experienceYears)}
                  className="text-left tabular-nums"
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">
                مدد شائعة:
              </span>
              {SLOT_DURATION_PRESETS.map((minutes) => {
                const isSelected =
                  formValues.slotDurationMinutes.trim() === String(minutes);
                return (
                  <Button
                    key={minutes}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    aria-pressed={isSelected}
                    onClick={() =>
                      updateField("slotDurationMinutes", String(minutes))
                    }
                    disabled={isSubmitting}
                    className="px-3.5 text-sm tabular-nums"
                  >
                    {minutes} دقيقة
                  </Button>
                );
              })}
            </div>

            <Field
              label="المؤهلات والدرجة العلمية (اختياري)"
              htmlFor={qualificationsInputId}
              error={fieldErrors.qualifications}
            >
              <Textarea
                id={qualificationsInputId}
                rows={2}
                value={formValues.qualifications}
                onChange={(event) =>
                  updateField("qualifications", event.target.value)
                }
                placeholder="مثال: دكتوراه واستشاري أمراض الباطنة والجهاز الهضمي"
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.qualifications)}
              />
            </Field>

            <Field
              label="نبذة عن الدكتور (اختياري)"
              htmlFor={bioInputId}
              error={fieldErrors.bio}
            >
              <Textarea
                id={bioInputId}
                rows={3}
                value={formValues.bio}
                onChange={(event) => updateField("bio", event.target.value)}
                placeholder="وصف مختصر يظهر للمرضى في صفحة الحجز."
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.bio)}
              />
            </Field>

            <label
              htmlFor={isActiveInputId}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-4"
            >
              <input
                id={isActiveInputId}
                type="checkbox"
                checked={formValues.isActive}
                onChange={(event) =>
                  updateField("isActive", event.target.checked)
                }
                disabled={isSubmitting}
                className="mt-1 size-5 shrink-0 accent-primary"
              />
              <span className="space-y-1">
                <span className="block text-sm font-bold text-foreground">
                  الدكتور نشط ومتاح للحجز
                </span>
                <span className="block text-xs leading-5 text-muted-foreground">
                  لو شلت العلامة، مش هيظهر للمرضى في الحجوزات الجديدة، لكن
                  الحجوزات السابقة هتفضل محفوظة وظاهرة للإدارة والاستقبال.
                </span>
              </span>
            </label>

            <DialogFooter>
              <Button
                type="submit"
                disabled={isSubmitting || isUploadingPhoto || missingDependencies}
              >
                {isSubmitting ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    جاري الحفظ...
                  </>
                ) : editingDoctor ? (
                  "حفظ التعديلات"
                ) : (
                  "إضافة الدكتور"
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogOpenChange(false)}
                disabled={isSubmitting || isUploadingPhoto}
              >
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
