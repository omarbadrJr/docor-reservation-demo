import type {
  Appointment,
  ManualAvailability,
  ScheduleException,
  WeeklySchedule,
} from "./database";

export type AvailabilityDateState = "AVAILABLE" | "FULL" | "OFF";

export type TimeWindow = {
  start: string;
  end: string;
};

export type TimeSlot = {
  start: string;
  end: string;
};

export type DoctorAvailability = {
  date: string;
  state: AvailabilityDateState;
  slots: TimeSlot[];
};

export type AvailableDate = {
  date: string;
  state: AvailabilityDateState;
};

export type WorkingWindowSource = {
  weekly: Pick<
    WeeklySchedule,
    "day_of_week" | "start_time" | "end_time" | "is_active"
  >[];
  manual: Pick<
    ManualAvailability,
    "availability_date" | "start_time" | "end_time"
  >[];
  exceptions: Pick<
    ScheduleException,
    "exception_date" | "exception_type" | "start_time" | "end_time"
  >[];
};

export type BookedWindow = Pick<
  Appointment,
  "appointment_date" | "start_time" | "end_time"
>;
