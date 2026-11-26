import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getDoctorAvailability,
  listDoctorAvailableDates,
} from "./availability";

const DOCTOR_ID = "33000000-0000-0000-0000-000000000001";
const CLINIC_ID = "11000000-0000-0000-0000-000000000001";

type Dataset = Record<string, Record<string, unknown>[]>;

const doctor = (isActive = true) => ({
  id: DOCTOR_ID,
  clinic_id: CLINIC_ID,
  slot_duration_minutes: 30,
  is_active: isActive,
});

const clinic = (isActive = true) => ({
  id: CLINIC_ID,
  name: "عيادة النيل",
  address: "شارع النيل، البحيرة",
  is_active: isActive,
});

const weekly = (
  dayOfWeek: number,
  start: string,
  end: string,
  isActive = true,
) => ({
  doctor_id: DOCTOR_ID,
  day_of_week: dayOfWeek,
  start_time: start,
  end_time: end,
  is_active: isActive,
});

const manual = (date: string, start: string, end: string) => ({
  doctor_id: DOCTOR_ID,
  availability_date: date,
  start_time: start,
  end_time: end,
});

const exception = (
  date: string,
  type: "CLOSED" | "MODIFIED_HOURS" | "EXTRA_HOURS",
  start: string | null = null,
  end: string | null = null,
) => ({
  doctor_id: DOCTOR_ID,
  exception_date: date,
  exception_type: type,
  start_time: start,
  end_time: end,
});

const appointment = (
  date: string,
  start: string,
  end: string,
  status = "CONFIRMED",
) => ({
  doctor_id: DOCTOR_ID,
  appointment_date: date,
  start_time: start,
  end_time: end,
  status,
});

function fakeClient(dataset: Dataset) {
  const activeStatuses = ["CONFIRMED", "CHECKED_IN"];

  const client = {
    rpc(
      functionName: string,
      args: {
        p_doctor_id: string;
        p_start_date: string;
        p_end_date: string;
      },
    ) {
      if (functionName !== "list_doctor_booked_windows") {
        return Promise.resolve({ data: null, error: new Error("unknown rpc") });
      }

      const data = (dataset.appointments ?? [])
        .filter(
          (row) =>
            row.doctor_id === args.p_doctor_id &&
            activeStatuses.includes(String(row.status)) &&
            String(row.appointment_date) >= args.p_start_date &&
            String(row.appointment_date) <= args.p_end_date,
        )
        .map((row) => ({
          appointment_date: row.appointment_date,
          start_time: row.start_time,
          end_time: row.end_time,
        }));

      return Promise.resolve({ data, error: null });
    },
    from(table: string) {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];

      const result = () =>
        (dataset[table] ?? []).filter((row) =>
          filters.every((filter) => filter(row)),
        );

      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (key: string, value: unknown) => {
          filters.push((row) => row[key] === value);
          return builder;
        },
        in: (key: string, values: unknown[]) => {
          filters.push((row) => values.includes(row[key]));
          return builder;
        },
        gte: (key: string, value: unknown) => {
          filters.push((row) => String(row[key]) >= String(value));
          return builder;
        },
        lte: (key: string, value: unknown) => {
          filters.push((row) => String(row[key]) <= String(value));
          return builder;
        },
        order: () => builder,
        maybeSingle: async () => {
          const rows = result();
          return { data: rows[0] ?? null, error: null };
        },
        then: (
          resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve({ data: result(), error: null }).then(resolve, reject),
      };

      return builder;
    },
  };

  return client as unknown as Parameters<typeof getDoctorAvailability>[0];
}

const baseDataset = (): Dataset => ({
  doctors: [doctor()],
  clinics: [clinic()],
  weekly_schedules: [weekly(0, "09:00:00", "10:00:00")],
  manual_availability: [],
  schedule_exceptions: [],
  appointments: [],
});

describe("getDoctorAvailability", () => {
  it("returns generated slots for a normal working day", async () => {
    const result = await getDoctorAvailability(
      fakeClient(baseDataset()),
      DOCTOR_ID,
      "2026-11-01",
      { date: "2026-11-01", time: "08:00" },
    );

    assert.deepEqual(result, {
      date: "2026-11-01",
      state: "AVAILABLE",
      slots: [
        { start: "09:00", end: "09:30" },
        { start: "09:30", end: "10:00" },
      ],
    });
  });

  it("returns null for an inactive doctor", async () => {
    assert.equal(
      await getDoctorAvailability(
        fakeClient({ ...baseDataset(), doctors: [doctor(false)] }),
        DOCTOR_ID,
        "2026-11-01",
        { date: "2026-11-01", time: "08:00" },
      ),
      null,
    );
  });

  it("returns null for an active doctor in an inactive clinic", async () => {
    assert.equal(
      await getDoctorAvailability(
        fakeClient({ ...baseDataset(), clinics: [clinic(false)] }),
        DOCTOR_ID,
        "2026-11-01",
        { date: "2026-11-01", time: "08:00" },
      ),
      null,
    );
  });

  it("still offers manual availability on a CLOSED day", async () => {
    const result = await getDoctorAvailability(
      fakeClient({
        ...baseDataset(),
        schedule_exceptions: [exception("2026-11-01", "CLOSED")],
        manual_availability: [manual("2026-11-01", "18:00:00", "19:00:00")],
      }),
      DOCTOR_ID,
      "2026-11-01",
      { date: "2026-11-01", time: "08:00" },
    );

    assert.deepEqual(result?.slots, [
      { start: "18:00", end: "18:30" },
      { start: "18:30", end: "19:00" },
    ]);
  });

  it("removes slots that overlap an active booking", async () => {
    const result = await getDoctorAvailability(
      fakeClient({
        ...baseDataset(),
        appointments: [appointment("2026-11-01", "09:00:00", "09:30:00")],
      }),
      DOCTOR_ID,
      "2026-11-01",
      { date: "2026-11-01", time: "08:00" },
    );

    assert.deepEqual(result?.slots, [{ start: "09:30", end: "10:00" }]);
  });

  it("does not let a cancelled booking block a slot", async () => {
    const result = await getDoctorAvailability(
      fakeClient({
        ...baseDataset(),
        appointments: [
          appointment("2026-11-01", "09:00:00", "09:30:00", "CANCELLED"),
        ],
      }),
      DOCTOR_ID,
      "2026-11-01",
      { date: "2026-11-01", time: "08:00" },
    );

    assert.deepEqual(result?.slots, [
      { start: "09:00", end: "09:30" },
      { start: "09:30", end: "10:00" },
    ]);
  });
});

describe("listDoctorAvailableDates", () => {
  it("classifies AVAILABLE, FULL, and OFF dates across a month", async () => {
    const result = await listDoctorAvailableDates(
      fakeClient({
        ...baseDataset(),
        weekly_schedules: [weekly(0, "09:00:00", "10:00:00")],
        manual_availability: [manual("2026-11-02", "18:00:00", "19:00:00")],
        schedule_exceptions: [exception("2026-11-08", "CLOSED")],
        appointments: [
          appointment("2026-11-15", "09:00:00", "09:30:00"),
          appointment("2026-11-15", "09:30:00", "10:00:00"),
        ],
      }),
      DOCTOR_ID,
      "2026-11",
      { date: "2026-10-31", time: "08:00" },
    );

    assert.equal(result?.length, 30);
    assert.deepEqual(result?.find((entry) => entry.date === "2026-11-01"), {
      date: "2026-11-01",
      state: "AVAILABLE",
    });
    assert.deepEqual(result?.find((entry) => entry.date === "2026-11-02"), {
      date: "2026-11-02",
      state: "AVAILABLE",
    });
    assert.deepEqual(result?.find((entry) => entry.date === "2026-11-08"), {
      date: "2026-11-08",
      state: "OFF",
    });
    assert.deepEqual(result?.find((entry) => entry.date === "2026-11-15"), {
      date: "2026-11-15",
      state: "FULL",
    });
    assert.deepEqual(result?.find((entry) => entry.date === "2026-11-03"), {
      date: "2026-11-03",
      state: "OFF",
    });
  });

  it("returns null for an inactive doctor", async () => {
    assert.equal(
      await listDoctorAvailableDates(
        fakeClient({ ...baseDataset(), doctors: [doctor(false)] }),
        DOCTOR_ID,
        "2026-11",
        { date: "2026-10-31", time: "08:00" },
      ),
      null,
    );
  });
});
