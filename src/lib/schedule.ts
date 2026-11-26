import type { WeeklySchedule } from "@/types/database";

type WorkingScheduleRow = Pick<
  WeeklySchedule,
  "day_of_week" | "start_time" | "end_time"
>;

const weekdayLabels = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
] as const;

function formatTime(value: string): string {
  const [hourPart, minutes] = value.split(":");
  const hours = Number(hourPart);
  const hour = hours % 12 || 12;
  const period = hours < 12 ? "الصبح" : "بالليل";
  return `${hour}:${minutes} ${period}`;
}

export function formatWorkingSchedule(rows: WorkingScheduleRow[]): string[] {
  return rows.map((row) => {
    const label = weekdayLabels[row.day_of_week] ?? "يوم غير محدد";
    return `${label}: ${formatTime(row.start_time)} - ${formatTime(row.end_time)}`;
  });
}
