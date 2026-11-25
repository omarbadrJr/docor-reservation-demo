import Link from "next/link";
import {
  ArrowLeft,
  CalendarCheck2,
  CalendarPlus,
  ClipboardCheck,
  Clock3,
  MapPin,
  QrCode,
  Search,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const steps = [
  {
    title: "اختار التخصص",
    description: "شوف التخصصات المتاحة واختار اللي محتاجه.",
    icon: Stethoscope,
  },
  {
    title: "اختار الدكتور والمعاد",
    description: "شوف بيانات الدكتور والمواعيد المتاحة قدامك.",
    icon: CalendarCheck2,
  },
  {
    title: "أكّد الحجز",
    description: "اكتب اسمك ورقمك، وهتاخد رقم حجز وكود QR.",
    icon: ClipboardCheck,
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <section className="grid gap-10 py-10 sm:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
        <div className="max-w-2xl">
          <h1 className="text-balance text-4xl leading-[1.2] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            عايز تكشف عند دكتور إيه؟
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">
            اختار التخصص والدكتور، وشوف المواعيد المتاحة، واحجز في دقيقة من غير
            حساب ولا خطوات كتير.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/specialties"
              className={cn(
                buttonVariants({ size: "xl" }),
                "w-full sm:w-auto",
              )}
            >
              <CalendarPlus className="size-5" aria-hidden="true" />
              احجز عند دكتور
            </Link>
            <Link
              href="/my-booking"
              className={cn(
                buttonVariants({ variant: "outline", size: "xl" }),
                "w-full sm:w-auto",
              )}
            >
              <Search className="size-5" aria-hidden="true" />
              عندي حجز بالفعل
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-muted-foreground">
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              من غير حساب
            </li>
            <li className="flex items-center gap-2">
              <Clock3 className="size-4 text-primary" aria-hidden="true" />
              الحجز بياخد دقيقة
            </li>
            <li className="flex items-center gap-2">
              <QrCode className="size-4 text-primary" aria-hidden="true" />
              رقم وكود للحجز
            </li>
          </ul>
        </div>

        <div className="relative">
          <div
            className="absolute -inset-3 -z-10 rounded-[2.5rem] bg-secondary/70 sm:-inset-4"
            aria-hidden="true"
          />
          <div className="rounded-[2rem] border border-border bg-card p-5 shadow-[0_24px_60px_-36px_rgba(15,95,92,0.45)] sm:p-6">
            <div className="flex items-center justify-between gap-4 border-b border-border pb-5">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  إزاي تحجز؟
                </p>
                <p className="mt-1 text-xl font-extrabold">3 خطوات بس</p>
              </div>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <MapPin className="size-6" aria-hidden="true" />
              </span>
            </div>

            <ol className="mt-1 divide-y divide-border">
              {steps.map((step) => {
                const Icon = step.icon;
                return (
                  <li key={step.title} className="flex gap-4 py-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-extrabold">{step.title}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-[2rem] bg-primary px-6 py-8 text-primary-foreground sm:px-10 sm:py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 className="text-2xl font-extrabold sm:text-3xl">
              عندك حجز وعايز تغيّره؟
            </h2>
            <p className="mt-2 leading-7 text-primary-foreground/80">
              تقدر تدور برقم الحجز أو رقم الموبايل، وتغيّر معادك أو تلغي الحجز.
            </p>
          </div>
          <Link
            href="/my-booking"
            className={cn(
              buttonVariants({ variant: "secondary", size: "lg" }),
              "shrink-0",
            )}
          >
            عندي حجز بالفعل
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
