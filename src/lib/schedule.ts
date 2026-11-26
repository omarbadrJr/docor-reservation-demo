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

function trimTime(value: string): string {
  return value.slice(0, 5);
}

export function formatWorkingSchedule(rows: WorkingScheduleRow[]): string[] {
  return rows.map((row) => {
    const label = weekdayLabels[row.day_of_week] ?? "يوم غير محدد";
    return `${label}: ${trimTime(row.start_time)} - ${trimTime(row.end_time)}`;
  });
}
