import { dayOfWeek } from "@/lib/cairo-time";

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const arabicMonths = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
] as const;

const arabicWeekdays = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
] as const;

export function formatConsultationFee(value: string): string {
  return `${numberFormatter.format(Number(value))} جنيه`;
}

export function formatExperienceYears(years: number | null): string | null {
  return years === null ? null : `${numberFormatter.format(years)} سنين خبرة`;
}

export function formatArabicDate(date: string): string {
  const [yearPart, monthPart, dayPart] = date.split("-");
  const weekday = arabicWeekdays[dayOfWeek(date)];
  const month = arabicMonths[Number(monthPart) - 1];
  const day = Number(dayPart);

  if (!weekday || !month || !yearPart || Number.isNaN(day)) {
    return date;
  }

  return `${weekday}، ${day} ${month} ${yearPart}`;
}

export function formatArabicMonth(month: string): string {
  const [yearPart, monthPart] = month.split("-");
  const monthName = arabicMonths[Number(monthPart) - 1];

  if (!monthName || !yearPart) {
    return month;
  }

  return `${monthName} ${yearPart}`;
}
